import { NextResponse } from "next/server";
import { isSupabaseConfigured, listRoutes, saveRoute } from "@/lib/routeStore";

/** Supabase is reached over fetch; keep this on Node so env vars are readable. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROUTE_NAME_LENGTH = 200;
const MAX_STOPS = 200;
const MAX_PATH_POINTS = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseStops(value: unknown): { name: string; lat: number; lng: number }[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STOPS).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const lat = Number(entry.lat);
    const lng = Number(entry.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
    return [{ name, lat, lng }];
  });
}

function parsePath(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_PATH_POINTS).flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return [];
    const lat = Number(entry[0]);
    const lng = Number(entry[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
    return [[lat, lng] as [number, number]];
  });
}

/** GET /api/routes — saved routes for the LOGGED ROUTES layer. */
export async function GET() {
  const { routes, source } = await listRoutes();
  return NextResponse.json(
    { routes, count: routes.length, source, supabaseConfigured: isSupabaseConfigured() },
    { status: 200 },
  );
}

/** POST /api/routes — persists a normalized route, in Supabase when configured. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON", detail: 'Expected a route object with routeName and stops.' },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be a route object" }, { status: 400 });
  }

  const routeName = text(body.routeName, "");
  if (!routeName) {
    return NextResponse.json({ error: "routeName is required" }, { status: 400 });
  }
  if (routeName.length > MAX_ROUTE_NAME_LENGTH) {
    return NextResponse.json(
      { error: "routeName is too long", detail: `Limit is ${MAX_ROUTE_NAME_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const stops = parseStops(body.stops);
  const pathCoordinates = parsePath(body.pathCoordinates);
  if (stops.length < 2 && pathCoordinates.length < 2) {
    return NextResponse.json(
      { error: "A route needs at least two stops or two path points" },
      { status: 400 },
    );
  }

  const { route, persisted, warning } = await saveRoute({
    routeName,
    vehicleType: text(body.vehicleType, "Shared Auto"),
    estimatedFare: text(body.estimatedFare, "Unknown"),
    frequency: text(body.frequency, "Unknown"),
    stops,
    pathCoordinates: pathCoordinates.length >= 2 ? pathCoordinates : stops.map((stop) => [stop.lat, stop.lng]),
  });

  return NextResponse.json(
    {
      route,
      persisted,
      source: persisted ? "supabase" : "demo",
      // Never a silent failure: the caller can show exactly where it went.
      message: persisted
        ? "Saved to Supabase."
        : warning
          ? `Supabase write failed (${warning}); the route is kept in memory for this session.`
          : "Supabase is not configured; the route is kept in memory for this session.",
    },
    { status: persisted ? 201 : 200 },
  );
}
