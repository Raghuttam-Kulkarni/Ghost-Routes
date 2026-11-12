import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  toPath,
  toStops,
  type CommunityRoute,
  type CommunityRouteStop,
} from '@/lib/community-routes';
import type { LatLngTuple } from '@/lib/geo';

/**
 * Server-only store for community routes. Supabase is the real database; when
 * it is not configured the same pattern as `lib/bookings.ts` is used, so the
 * demo flow keeps working against a local JSON file.
 */

const TABLE = 'routes';
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'community-routes.json');

export type NewCommunityRoute = {
  origin: string;
  destination: string;
  description: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  route_name: string | null;
  vehicle_type: string | null;
  estimated_fare: string | null;
  frequency: string | null;
  stops: CommunityRouteStop[] | null;
  path: LatLngTuple[] | null;
  ai_normalized: boolean;
};

export type RouteStore = 'supabase' | 'local-file';

export function routeStore(): RouteStore {
  return isSupabaseConfigured() ? 'supabase' : 'local-file';
}

/** Normalizes a stored row (Supabase jsonb arrives as structured JSON). */
function hydrate(row: Record<string, unknown>): CommunityRoute {
  return {
    id: String(row.id),
    origin: String(row.origin ?? ''),
    destination: String(row.destination ?? ''),
    description: typeof row.description === 'string' ? row.description : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    origin_lat: row.origin_lat == null ? null : Number(row.origin_lat),
    origin_lng: row.origin_lng == null ? null : Number(row.origin_lng),
    dest_lat: row.dest_lat == null ? null : Number(row.dest_lat),
    dest_lng: row.dest_lng == null ? null : Number(row.dest_lng),
    route_name: typeof row.route_name === 'string' ? row.route_name : null,
    vehicle_type: typeof row.vehicle_type === 'string' ? row.vehicle_type : null,
    estimated_fare: typeof row.estimated_fare === 'string' ? row.estimated_fare : null,
    frequency: typeof row.frequency === 'string' ? row.frequency : null,
    stops: toStops(row.stops),
    path: toPath(row.path),
    ai_normalized: row.ai_normalized === true,
  };
}

async function readRows(): Promise<CommunityRoute[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => hydrate(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

async function writeRows(rows: CommunityRoute[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(rows, null, 2), 'utf8');
  await fs.rename(temp, DATA_FILE);
}

export async function listCommunityRoutes(): Promise<CommunityRoute[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => hydrate(row as Record<string, unknown>));
  }

  return readRows();
}

export async function insertCommunityRoute(input: NewCommunityRoute): Promise<CommunityRoute> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .insert({
        ...input,
        // jsonb columns accept the arrays directly.
        stops: input.stops,
        path: input.path,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return hydrate(data as Record<string, unknown>);
  }

  const row: CommunityRoute = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };

  const rows = await readRows();
  rows.unshift(row);
  await writeRows(rows);
  return row;
}
