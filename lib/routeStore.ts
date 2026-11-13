/**
 * Persistence for logged routes.
 *
 * Supabase is reached over its REST (PostgREST) endpoint with plain `fetch`, so
 * the project needs no extra SDK dependency and nothing initialises at import
 * time. When the environment variables are missing or the request fails, routes
 * are kept in this module's memory instead: the UI keeps working end to end and
 * reports where the data actually went.
 */

import type { DemoStop } from "@/lib/bengaluru";

export interface SavedRoute {
  id: string;
  routeName: string;
  vehicleType: string;
  estimatedFare: string;
  frequency: string;
  stops: DemoStop[];
  pathCoordinates: [number, number][];
  source: "supabase" | "demo";
  createdAt: string;
}

export type RouteInput = Omit<SavedRoute, "id" | "source" | "createdAt">;

export interface SaveResult {
  route: SavedRoute;
  persisted: boolean;
  /** Present when Supabase was configured but the write failed. */
  warning?: string;
}

const TABLE = "routes";
const REQUEST_TIMEOUT_MS = 6000;

function supabaseUrl(): string | null {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

function supabaseKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null
  );
}

/** True when both the URL and a key are present, so writes can reach Supabase. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseKey());
}

/**
 * Fallback buffer for writes when Supabase is unreachable. Starts empty on
 * purpose: nothing is seeded, so the app never shows invented routes.
 */
const memory: SavedRoute[] = [];

function readId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `route-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function headers(key: string): Record<string, string> {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

interface RouteRow {
  id?: string;
  route_name?: string;
  vehicle_type?: string;
  estimated_fare?: string;
  frequency?: string;
  stops?: unknown;
  path_coordinates?: unknown;
  created_at?: string;
}

function toStops(value: unknown): DemoStop[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as { name?: unknown; lat?: unknown; lng?: unknown };
    const lat = Number(record.lat);
    const lng = Number(record.lng);
    if (typeof record.name !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ name: record.name, lat, lng }];
  });
}

function toPath(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return [];
    const lat = Number(entry[0]);
    const lng = Number(entry[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [[lat, lng] as [number, number]];
  });
}

function fromRow(row: RouteRow): SavedRoute | null {
  if (!row.route_name) return null;
  return {
    id: row.id ?? readId(),
    routeName: row.route_name,
    vehicleType: row.vehicle_type ?? "Shared Auto",
    estimatedFare: row.estimated_fare ?? "Unknown",
    frequency: row.frequency ?? "Unknown",
    stops: toStops(row.stops),
    pathCoordinates: toPath(row.path_coordinates),
    source: "supabase",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function toRow(input: RouteInput): RouteRow {
  return {
    route_name: input.routeName,
    vehicle_type: input.vehicleType,
    estimated_fare: input.estimatedFare,
    frequency: input.frequency,
    stops: input.stops,
    path_coordinates: input.pathCoordinates,
  };
}

async function call(url: string, key: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

/** Supabase rows only: an empty table yields an empty list, never demo data. */
export async function listRoutes(): Promise<{ routes: SavedRoute[]; source: "supabase" | "demo" }> {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return { routes: [...memory], source: "demo" };

  try {
    const response = await call(`${url}/rest/v1/${TABLE}?select=*&order=created_at.desc&limit=50`, key, {
      method: "GET",
      headers: headers(key),
    });
    if (!response.ok) throw new Error(`Supabase responded ${response.status}`);

    const rows = (await response.json()) as RouteRow[];
    const stored = rows.map(fromRow).filter((route): route is SavedRoute => route !== null);
    return { routes: stored, source: "supabase" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[routeStore] list failed (${message}) — serving nothing instead of demo routes`);
    return { routes: [...memory], source: "demo" };
  }
}

/** Writes the route to Supabase when configured, otherwise keeps it in memory. */
export async function saveRoute(input: RouteInput): Promise<SaveResult> {
  const url = supabaseUrl();
  const key = supabaseKey();

  const local: SavedRoute = {
    id: readId(),
    ...input,
    source: "demo",
    createdAt: new Date().toISOString(),
  };

  if (!url || !key) {
    memory.unshift(local);
    return { route: local, persisted: false };
  }

  try {
    const response = await call(`${url}/rest/v1/${TABLE}`, key, {
      method: "POST",
      headers: { ...headers(key), prefer: "return=representation" },
      body: JSON.stringify(toRow(input)),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Supabase responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }

    const rows = (await response.json()) as RouteRow[];
    const saved = rows.map(fromRow).find((route): route is SavedRoute => route !== null);
    memory.unshift(saved ?? local);
    return { route: saved ?? local, persisted: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[routeStore] save failed (${message}) — keeping the route in memory`);
    memory.unshift(local);
    return { route: local, persisted: false, warning: message };
  }
}
