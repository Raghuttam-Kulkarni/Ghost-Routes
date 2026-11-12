import { distanceKm, type LatLngTuple } from '@/lib/geo';

/** An ordered stop produced by the ai-maps normalizer (lat/lng in degrees). */
export type CommunityRouteStop = {
  name: string;
  lat: number;
  lng: number;
};

/**
 * A community route row. The first block is the backend branch's shape
 * (`origin`/`destination` place names plus geocoded endpoints); the second is
 * the AI-normalized route the ai-maps module adds on top of it.
 */
export type CommunityRoute = {
  id: string;
  origin: string;
  destination: string;
  description: string | null;
  created_at: string;
  origin_lat: number | null;
  origin_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  /** Route name from the AI normalizer, e.g. "Majestic to Koramangala". */
  route_name: string | null;
  /** "Shared Auto" | "Minibus" | "Informal Van". */
  vehicle_type: string | null;
  estimated_fare: string | null;
  frequency: string | null;
  /** Ordered stops from the AI normalizer. */
  stops: CommunityRouteStop[] | null;
  /** Road-snapped path as `[lat, lng]` pairs, ready for a Leaflet polyline. */
  path: LatLngTuple[] | null;
  /** True when the row carries a live AI-normalized, road-snapped route. */
  ai_normalized: boolean;
};

function isLatLng(value: unknown): value is LatLngTuple {
  if (!Array.isArray(value) || value.length < 2) return false;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Coerces a stored `path` column (jsonb or a stringified array) into pairs. */
export function toPath(value: unknown): LatLngTuple[] | null {
  const parsed = typeof value === 'string' ? safeParse(value) : value;
  if (!Array.isArray(parsed)) return null;

  const path = parsed.filter(isLatLng).map((pair) => [Number(pair[0]), Number(pair[1])] as LatLngTuple);
  return path.length >= 2 ? path : null;
}

/** Coerces a stored `stops` column into typed stops. */
export function toStops(value: unknown): CommunityRouteStop[] | null {
  const parsed = typeof value === 'string' ? safeParse(value) : value;
  if (!Array.isArray(parsed)) return null;

  const stops = parsed.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const lat = Number(record.lat);
    const lng = Number(record.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ name, lat, lng }];
  });

  return stops.length > 0 ? stops : null;
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function communityRoutePoints(route: CommunityRoute): [LatLngTuple, LatLngTuple] | null {
  if (route.origin_lat == null || route.origin_lng == null || route.dest_lat == null || route.dest_lng == null) return null
  return [[route.origin_lat, route.origin_lng], [route.dest_lat, route.dest_lng]]
}

/**
 * The line to draw: the AI-normalized, road-snapped path when the row has one,
 * otherwise the straight connection between the two geocoded places.
 */
export function communityRoutePath(route: CommunityRoute): LatLngTuple[] | null {
  const path = toPath(route.path);
  if (path) return path;

  const points = communityRoutePoints(route);
  return points ? [points[0], points[1]] : null;
}

/** Length of the drawn route, following the snapped path when present. */
export function communityRouteDistanceKm(route: CommunityRoute): number | null {
  const path = communityRoutePath(route);
  if (!path) return null;

  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += distanceKm(path[index - 1], path[index]);
  }
  return total;
}

export function formatCommunityRouteDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
