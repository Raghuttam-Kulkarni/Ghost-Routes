# Ghost-Routes

Log a journey between two places, describe what happened, and see the route drawn on a dark Leaflet map.

Next.js 16 (App Router) · TypeScript · Tailwind CSS · react-leaflet 5 · Supabase

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # http://localhost:3000
```

Environment variables (Supabase dashboard → Project Settings → API):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

These are read only on the server (inside `app/api/routes`), so the key never reaches the browser
bundle. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` still work as a fallback for
older setups. On a host, add the two values as runtime secrets with the same names — no rebuild needed.

## Database

Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL editor. It creates the
`routes` table, adds the four nullable coordinate columns the map needs, and installs the public
SELECT / INSERT RLS policies.

If your table already exists, the `alter table ... add column if not exists` lines upgrade it in
place; nothing is dropped and existing rows keep `null` coordinates (they show as "unlocated" in the
UI until relogged).

## How the pieces fit

| Path | Role |
| --- | --- |
| `lib/supabase.ts` | Lazy server-side Supabase client + config check |
| `lib/geocode.ts` | Place → coordinates via OpenStreetMap Nominatim, serialized and cached |
| `app/api/routes/route.ts` | `GET` list routes, `POST` validate → geocode → insert |
| `components/RouteExplorer.tsx` | Client shell: form, fetch, list, selection state |
| `components/RouteMap.tsx` | Leaflet map, markers, dashed polylines, fly-to selection |

`RouteMap` is imported with `ssr: false` because Leaflet touches `window` and must not render on the server.

Geocoding fails gracefully: a route is still saved, it is just flagged **unlocated** and is not drawn.
Nominatim allows roughly one request per second, so the two lookups in a POST run sequentially with a
small cache and a retry; a POST takes a few seconds.

## Versions

`next@16`, `react@19`, `react-leaflet@5` — these are the versions the Cloudflare/OpenNext adapter
supports. On `next@14`, `react-leaflet@4` is the matching pair, but that combination cannot be deployed
to Freebuff Sites, whose adapter requires Next 15.5.28+ or 16.4.1+.

`typescript` is pinned to `^5.6.3`. A `^7.0.2` range in `package.json` does not resolve reliably.

## Notes

- Tiles come from CARTO's dark basemap; geocoding uses Nominatim's public endpoint, which requires a
  descriptive `User-Agent` (already set). Swap in a paid geocoder before high-volume use.
- Routes are drawn as straight dashed lines between the two geocoded points, not road geometry.
