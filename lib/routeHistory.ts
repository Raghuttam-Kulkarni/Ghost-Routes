/**
 * Real logged-route history, straight from Supabase.
 *
 * The home page renders only what this module returns: no seed data, no demo
 * fallback. If Supabase is not configured, the table is empty or a row carries
 * no usable geometry, the page gets `[]` and simply shows the clean dark map.
 *
 * Every fetched route is passed through the public OSRM router so its line
 * follows real streets instead of cutting across buildings and parks.
 */

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { snapToRoads } from '@/lib/snapToRoads'
import { VEHICLE_TYPES, type GhostRoute, type RouteStop, type VehicleType } from '@/lib/routes'

const TABLE = 'routes'
const MAX_ROWS = 100
/** Sampling cap keeps the OSRM URL well under the demo server's 100-waypoint limit. */
const MAX_WAYPOINTS = 25

type RouteRow = {
  id?: string | number | null
  route_name?: string | null
  vehicle_type?: string | null
  estimated_fare?: string | null
  frequency?: string | null
  stops?: unknown
  path_coordinates?: unknown
  created_at?: string | null
}

type Point = { lat: number; lng: number; name?: string }

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function validPoint(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** `stops` is jsonb: `[{ name, lat, lng }]` (older rows use `lon`). */
function parseStops(value: unknown, routeName: string): RouteStop[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry, index) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as { name?: unknown; lat?: unknown; lng?: unknown; lon?: unknown }
    const lat = numberOrNull(record.lat)
    const lng = numberOrNull(record.lng ?? record.lon)
    if (!validPoint(lat, lng)) return []

    return [
      {
        id: `${routeName}-stop-${index}`,
        name: typeof record.name === 'string' && record.name.trim() ? record.name : `Stop ${index + 1}`,
        lat: lat as number,
        lon: lng as number,
        sightings: 0,
      },
    ]
  })
}

/** `path_coordinates` is jsonb: `[[lat, lng], …]`, the order Leaflet draws. */
function parsePath(value: unknown): Point[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return []
    const lat = numberOrNull(entry[0])
    const lng = numberOrNull(entry[1])
    if (!validPoint(lat, lng)) return []
    return [{ lat: lat as number, lng: lng as number }]
  })
}

/** "₹20–30", "20 - 30", "25" and similar all collapse to a fare range. */
function parseFare(value: string | null | undefined): [number, number] {
  const numbers = (value ?? '').match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? []
  if (numbers.length === 0) return [0, 0]
  if (numbers.length === 1) return [numbers[0], numbers[0]]
  return [Math.min(numbers[0], numbers[1]), Math.max(numbers[0], numbers[1])]
}

function parseVehicleType(value: string | null | undefined): VehicleType {
  const raw = (value ?? '').toLowerCase()
  const direct = VEHICLE_TYPES.find((type) => raw.includes(type))
  if (direct) return direct
  if (raw.includes('mini')) return 'minibus'
  if (raw.includes('jeep') || raw.includes('maxi')) return 'jeep'
  if (raw.includes('bus')) return 'bus'
  return 'auto'
}

/** Headways cannot be derived from history, so the schedule stays empty. */
function parseFrequency(): GhostRoute['frequency'] {
  return []
}

function downsample<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items
  const step = (items.length - 1) / (limit - 1)
  return Array.from({ length: limit }, (_, index) => items[Math.round(index * step)])
}

/**
 * OSRM waypoints: the stops when the row has enough of them, otherwise a
 * downsampled version of the stored track. `snapToRoads` takes `{ lat, lng }`.
 */
function osmWaypoints(stops: RouteStop[], path: Point[]): { lat: number; lng: number }[] {
  if (stops.length >= 2) {
    return downsample(
      stops.map((stop) => ({ lat: stop.lat, lng: stop.lon })),
      MAX_WAYPOINTS,
    )
  }

  return downsample(
    path.map((point) => ({ lat: point.lat, lng: point.lng })),
    MAX_WAYPOINTS,
  )
}

async function toGhostRoute(row: RouteRow): Promise<GhostRoute | null> {
  const name = typeof row.route_name === 'string' ? row.route_name.trim() : ''
  if (!name) return null

  const stops = parseStops(row.stops, name)
  const storedPath = parsePath(row.path_coordinates)
  const waypoints = osmWaypoints(stops, storedPath)
  if (waypoints.length < 2) return null

  // Real street geometry from OSRM, `[lat, lng]`; the stored track is only a
  // fallback for the rare case where the router cannot answer.
  const snapped = await snapToRoads(waypoints)
  const path = snapped && snapped.length >= 2 ? snapped.map(([lat, lng]) => ({ lat, lng })) : storedPath
  if (path.length < 2) return null

  const [fareMin, fareMax] = parseFare(row.estimated_fare)
  const createdAt = row.created_at ? new Date(row.created_at) : null
  const createdHour = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getHours() : 0

  return {
    id: String(row.id ?? name),
    name,
    vehicleType: parseVehicleType(row.vehicle_type),
    fareMin,
    fareMax,
    fareReports: 0,
    startLandmark: stops.at(0)?.name ?? '',
    endLandmark: stops.at(-1)?.name ?? '',
    firstVehicleHour: createdHour,
    lastVehicleHour: createdHour,
    // GhostRoute geometry is GeoJSON `[lng, lat]`; the snapped path is `[lat, lng]`.
    geometry: {
      type: 'LineString',
      coordinates: path.map((point) => [point.lng, point.lat] as [number, number]),
    },
    stops,
    frequency: parseFrequency(),
    confidence: 0.5,
    sightingsThisWeek: 0,
  }
}

/**
 * Fetches logged route history and snaps it to roads.
 *
 * Returns an empty list — never seed data — when Supabase is unconfigured, the
 * query fails or nothing usable is stored.
 */
export async function fetchRouteHistory(): Promise<GhostRoute[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[routeHistory] Supabase is not configured — rendering an empty map')
    return []
  }

  try {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS)

    if (error) {
      console.warn(`[routeHistory] Supabase query failed (${error.message}) — rendering an empty map`)
      return []
    }

    const rows = (data ?? []) as RouteRow[]
    const mapped = await Promise.all(rows.map((row) => toGhostRoute(row)))

    return mapped.filter((route): route is GhostRoute => route !== null)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.warn(`[routeHistory] fetch failed (${message}) — rendering an empty map`)
    return []
  }
}
