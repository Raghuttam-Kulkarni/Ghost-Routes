import type { Route } from './types';

export type LatLngTuple = [number, number];

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Returns the two map points for a route, or null when either end is unlocated. */
export function plottedPoints(
  route: Route,
): { origin: LatLngTuple; destination: LatLngTuple } | null {
  const { origin_lat, origin_lng, dest_lat, dest_lng } = route;

  if (origin_lat == null || origin_lng == null || dest_lat == null || dest_lng == null) {
    return null;
  }

  return {
    origin: [origin_lat, origin_lng],
    destination: [dest_lat, dest_lng],
  };
}

export function distanceKm(a: LatLngTuple, b: LatLngTuple): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en-US')} km`;
}
