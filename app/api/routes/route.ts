import { NextResponse } from 'next/server';
import { geocodePlace } from '@/lib/geocode';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { CommunityRoute } from '@/lib/community-routes';

export const dynamic = 'force-dynamic';

const TABLE = 'routes';
const MAX_PLACE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 600;

const CONFIG_ERROR =
  'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local (or the hosting secrets).';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected server error.';
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: CONFIG_ERROR }, { status: 503 });
  }

  try {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ routes: (data ?? []) as CommunityRoute[] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: CONFIG_ERROR }, { status: 503 });
  }

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
    // Sequential on purpose: the geocoder enforces a one-request-per-second limit.
    const originPoint = await geocodePlace(origin);
    const destinationPoint = await geocodePlace(destination);

    const { data, error } = await getSupabase()
      .from(TABLE)
      .insert({
        origin,
        destination,
        description: description || null,
        origin_lat: originPoint?.lat ?? null,
        origin_lng: originPoint?.lng ?? null,
        dest_lat: destinationPoint?.lat ?? null,
        dest_lng: destinationPoint?.lng ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        route: data as CommunityRoute,
        located: Boolean(originPoint && destinationPoint),
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
