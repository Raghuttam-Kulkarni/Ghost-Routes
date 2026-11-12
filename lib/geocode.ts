const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

/** Nominatim's usage policy allows at most one request per second. */
const MIN_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 1200;

export type Coordinates = { lat: number; lng: number };

const cache = new Map<string, Coordinates | null>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs geocode lookups one at a time so bursts never trip the rate limit. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - elapsed);
    lastRequestAt = Date.now();
    return task();
  });

  queue = result.catch(() => undefined);
  return result;
}

async function lookup(query: string): Promise<Coordinates | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');

  const request = await fetch(url, {
    headers: {
      // Nominatim's usage policy requires an identifying User-Agent.
      'User-Agent': 'Ghost-Routes/1.0 (Next.js demo app)',
      'Accept-Language': 'en',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!request.ok) {
    const retryable = request.status === 429 || request.status >= 500;
    if (retryable) {
      await wait(RETRY_DELAY_MS);
      const retry = await fetch(url, {
        headers: {
          'User-Agent': 'Ghost-Routes/1.0 (Next.js demo app)',
          'Accept-Language': 'en',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!retry.ok) return null;
      return parse(retry);
    }
    return null;
  }

  return parse(request);
}

async function parse(response: Response): Promise<Coordinates | null> {
  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  const hit = results[0];
  if (!hit) return null;

  const lat = Number.parseFloat(hit.lat);
  const lng = Number.parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

/**
 * Resolves a free-text place name to coordinates using OpenStreetMap Nominatim.
 * Resolves to null instead of throwing, so a route can still be saved when a
 * place cannot be located.
 */
export async function geocodePlace(place: string): Promise<Coordinates | null> {
  const query = place.trim();
  if (!query) return null;

  const cacheKey = query.toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  try {
    const coordinates = await enqueue(() => lookup(query));
    cache.set(cacheKey, coordinates);
    return coordinates;
  } catch {
    return null;
  }
}
