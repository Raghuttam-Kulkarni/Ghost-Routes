import { NextResponse } from 'next/server';
import {
  MAX_RAW_INPUT_LENGTH,
  normalizeRouteText,
  readApiKey,
} from '@/lib/normalize-route';

/**
 * `POST /api/normalize-route` — the ai-maps contract, unchanged: messy route
 * notes in, one clean road-snapped route out. The frontend never renders this
 * module's own studio UI; it consumes the JSON (directly or through
 * `/api/routes`, which persists the result in the database).
 */

/** The Gen AI SDK needs Node APIs; keep this off the edge runtime. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorResponse(status: number, error: string, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

export async function POST(request: Request) {
  if (!readApiKey()) {
    console.warn('[normalize-route] GEMINI_API_KEY is not set — serving the demo fallback route');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'Request body must be valid JSON', 'Expected { "rawInput": string }.');
  }

  const rawInput = isRecord(body) ? body.rawInput : undefined;
  if (typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return errorResponse(400, 'rawInput is required', 'Provide a non-empty string describing the route.');
  }
  if (rawInput.length > MAX_RAW_INPUT_LENGTH) {
    return errorResponse(400, 'rawInput is too long', `Limit is ${MAX_RAW_INPUT_LENGTH} characters.`);
  }

  const normalized = await normalizeRouteText(rawInput);

  // Without a key, normalizeRouteText returns the demo route synchronously.
  if (!normalized) {
    return errorResponse(503, 'Route normalization is unavailable', 'Set GEMINI_API_KEY to enable the AI normalizer.');
  }

  return NextResponse.json(
    { ...normalized, isFallback: normalized.isFallback === true },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
