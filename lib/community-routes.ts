export type CommunityRoute = {
  id: string
  origin: string
  destination: string
  description: string | null
  created_at: string
  origin_lat: number | null
  origin_lng: number | null
  dest_lat: number | null
  dest_lng: number | null
}

export function communityRoutePoints(route: CommunityRoute): [[number, number], [number, number]] | null {
  if (route.origin_lat == null || route.origin_lng == null || route.dest_lat == null || route.dest_lng == null) return null
  return [[route.origin_lat, route.origin_lng], [route.dest_lat, route.dest_lng]]
}

export function formatCommunityRouteDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
