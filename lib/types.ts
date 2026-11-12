export type Route = {
  id: string;
  origin: string;
  destination: string;
  description: string | null;
  created_at: string;
  origin_lat: number | null;
  origin_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
};

export type NewRouteInput = {
  origin: string;
  destination: string;
  description?: string;
};
