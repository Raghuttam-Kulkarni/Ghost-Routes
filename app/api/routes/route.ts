import { NextResponse } from 'next/server';
import { geocodePlace } from '@/lib/geocode';
import { communityRouteInput, normalizeRouteText } from '@/lib/normalize-route';
import { insertCommunityRoute, listCommunityRoutes, routeStore } from '@/lib/community-route-store';
import type { CommunityRoute } from '@/lib/community-routes';

export const dynamic = 'force-dynamic';
/** Gemini + Nominatim + OSRM are all remote calls; allow a slow submission. */
export const maxDuration = 60;

const MAX_PLACE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 600;
/** Community submissions favour latency over the normalizer's retry model. */
const NORMALIZE_TIMEOUT_MS = 12_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected server error.';
}

export async function GET() {
  try {
    const routes = await listCommunityRoutes();
    return NextResponse.json(
      { routes, store: routeStore() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const origin = typeof body.origin === 'string' ? body.origin.trim() : '';
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Origin and destination are both required.' }, { status: 400 });
  }

  if (origin.length > MAX_PLACE_LENGTH || destination.length > MAX_PLACE_LENGTH) {
    return NextResponse.json(
      { error: `Origin and destination must be ${MAX_PLACE_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  try {
    // Places are geocoded (backend) while the ai-maps normalizer turns the notes
    // into ordered stops and a road-following path. They run together because
    // they hit different services, so a submission waits for the slower one only.
    const placesPromise = (async () => {
      // Sequential on purpose: the geocoder enforces a one-request-per-second limit.
      const originPoint = await geocodePlace(origin);
      const destinationPoint = await geocodePlace(destination);
      return { originPoint, destinationPoint };
    })();

    const normalizedPromise = normalizeRouteText(communityRouteInput(origin, destination, description), {
      timeoutMs: NORMALIZE_TIMEOUT_MS,
      // Never store the canned demo route against a real submission.
      allowFallback: false,
    }).catch((error: unknown) => {
      console.warn(`[api/routes] route normalization skipped: ${errorMessage(error)}`);
      return null;
    });

    const [{ originPoint, destinationPoint }, normalized] = await Promise.all([
      placesPromise,
      normalizedPromise,
    ]);

    // The model's own stop coordinates rescue a place the geocoder could not find.
    const firstStop = normalized?.stops[0] ?? null;
    const lastStop = normalized?.stops.at(-1) ?? null;

    const route: CommunityRoute = await insertCommunityRoute({
      origin,
      destination,
      description: description || null,
      origin_lat: originPoint?.lat ?? firstStop?.lat ?? null,
      origin_lng: originPoint?.lng ?? firstStop?.lng ?? null,
      dest_lat: destinationPoint?.lat ?? lastStop?.lat ?? null,
      dest_lng: destinationPoint?.lng ?? lastStop?.lng ?? null,
      route_name: normalized?.routeName ?? null,
      vehicle_type: normalized?.vehicleType ?? null,
      estimated_fare: normalized?.estimatedFare ?? null,
      frequency: normalized?.frequency ?? null,
      stops: normalized?.stops.length ? normalized.stops : null,
      path: normalized?.pathCoordinates.length ? normalized.pathCoordinates : null,
      ai_normalized: Boolean(normalized),
    });

    return NextResponse.json(
      {
        route,
        located: route.origin_lat != null && route.dest_lat != null,
        normalized: Boolean(normalized),
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
