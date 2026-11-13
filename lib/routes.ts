import mockRoutes from '@/data/mock-routes.json'

export type RouteStop = {
  id: string
  name: string
  lat: number
  lon: number
  sightings: number
}

export type RouteFrequency = {
  hour: number
  headway_min: number
}

export const VEHICLE_TYPES = ['auto', 'minibus', 'bus', 'jeep', 'van'] as const

export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  auto: 'Shared auto',
  minibus: 'Minibus',
  bus: 'Bus',
  jeep: 'Jeep',
  van: 'Van',
}

export type VehicleFilter = 'all' | VehicleType

export type GhostRoute = {
  id: string
  name: string
  vehicleType: VehicleType
  fareMin: number
  fareMax: number
  fareReports: number
  startLandmark: string
  endLandmark: string
  firstVehicleHour: number
  lastVehicleHour: number
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  stops: RouteStop[]
  frequency: RouteFrequency[]
  confidence: number
  sightingsThisWeek: number
}

export type RouteTier = 'solid' | 'flicker' | 'whisper'

export function getRouteTier(confidence: number): RouteTier {
  if (confidence > 0.7) return 'solid'
  if (confidence >= 0.4) return 'flicker'
  return 'whisper'
}

export function getRoutes(): GhostRoute[] {
  return mockRoutes as GhostRoute[]
}

export type RouteReportKind = 'rode' | 'not-running'

export type RouteReportResult = {
  id: string
  confidence: number
  sightingsThisWeek: number
}

// The single seam for community feedback: swap this body for a Supabase call
// later and every caller keeps working unchanged.
export async function applyRouteReport(
  route: GhostRoute,
  kind: RouteReportKind,
): Promise<RouteReportResult> {
  if (kind === 'rode') {
    return {
      id: route.id,
      confidence: Math.min(1, route.confidence + 0.02),
      sightingsThisWeek: route.sightingsThisWeek + 1,
    }
  }

  return {
    id: route.id,
    confidence: Math.max(0, route.confidence - 0.03),
    sightingsThisWeek: route.sightingsThisWeek,
  }
}

// Upcoming departure slots built from the route's headways: the top of each
// operating hour plus every headway after it, rolling into later days when the
// rest of today has no service left.
export function nextDepartures(route: GhostRoute, count = 6, now = new Date()): Date[] {
  const hours = [...route.frequency].sort((a, b) => a.hour - b.hour)
  if (hours.length === 0) return []

  const slots: Date[] = []

  for (let dayOffset = 0; dayOffset < 3 && slots.length < count * 4; dayOffset += 1) {
    for (const entry of hours) {
      const start = new Date(now)
      start.setDate(start.getDate() + dayOffset)
      start.setHours(entry.hour, 0, 0, 0)

      for (let minute = 0; minute < 60; minute += Math.max(entry.headway_min, 1)) {
        const time = new Date(start.getTime() + minute * 60_000)
        if (time.getTime() <= now.getTime() + 60_000) continue
        slots.push(time)
      }
    }
  }

  return slots
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, count)
}
