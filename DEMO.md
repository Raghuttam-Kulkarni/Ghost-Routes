# 90-second judged demo

## One line per branch (say these, in this order, while the map is on screen)

- **frontend** — "Everything you see is the frontend branch: the map, search, route sheets, sign-in and seat requests."
- **backend** — "The backend branch owns the data: it turns the place names into coordinates and stores the route in Postgres."
- **ai-maps** — "The ai-maps branch is the brain: Gemini turns messy rider notes into ordered stops, then OSRM snaps them onto real roads. It contributes no UI."

## Pre-flight (10 minutes before)

1. `npm install` (first time only), then `.env.local` with `GEMINI_API_KEY` (and the three Supabase values if you want the live database on screen).
2. `npm run dev`, open http://localhost:3000.
3. Prove the model answers before you present:
   `curl -s -X POST localhost:3000/api/normalize-route -H 'content-type: application/json' -d '{"rawInput":"shared auto from Majestic to Koramangala"}'`
   → you must see `"isFallback": false`.
4. Open the app once and press **Esc**. The 5-step tour opens automatically on a fresh browser profile; this marks it seen so it cannot interrupt judging. (Replaying it is **How it works**, top right, if you ever want it.)
5. Clean slate: `rm -rf .data` (local file store), or delete the rows in Supabase if you are using it.

Fresh terminal, browser at 100% zoom, panel closed.

## The run

| Time | Do exactly this | Say this |
| --- | --- | --- |
| 0:00 | App already open on the map | "Shared autos and minibuses in Bengaluru exist as word of mouth, not on any map. This is Ghost Routes." |
| 0:08 | Click **Where to?** (top centre), type `Koramangala`, click the first stop result | "Every line is a community sighting with a confidence level — that's the frontend branch, unchanged." |
| 0:20 | The route sheet opens: point at **Likely running now**, the fare range, **Next likely** | "One tap tells a rider when it runs, what it costs, and how solid the rumour is." |
| 0:28 | Press **Esc** or the **X** to close the sheet. Click **Share a route** (bottom right) | "Now the part the other two branches do. A rider describes a route the way people actually talk." |
| 0:33 | Origin: `Majestic Bus Station, Bengaluru`. Destination: `Forum Mall, Koramangala, Bengaluru`. Details: `shared auto via Sony World Signal, INR 25, every 10 mins`. Click **Share route** | "The backend geocodes both places and owns the Postgres row. At the same time the ai-maps normalizer asks Gemini for ordered stops." |
| 0:40 | While the button reads **Normalizing and sharing…** | "Then OSRM snaps the model's guess onto actual roads — if that fails it keeps the model's own path, so a submission never dead-ends." |
| 0:55 | Message reads "AI aligned it to roads and stops." Click the **X** on the panel (top right) | "That line is not a straight guess anymore: it follows the streets." |
| 1:00 | Click the new solid purple line | "The card is the model's own output: route name, vehicle, fare, frequency, the ordered stops, and the road-following distance." |
| 1:10 | Press **Esc**. Click any curated line, then **Request a seat** | "Seat requests need an account; browsing never does." |
| 1:15 | On the sign-in page click **Continue**; the booking form reopens | "Signed in, back on the route, form already open." |
| 1:20 | Click **Request seat**. Point at the **Booking code** (`GR-…`), then click **Simulate driver confirm (demo)** | "The rider gets a code to show the driver. Payment stays cash — no online payments." |
| 1:27 | Click **Done**, press **Esc** to clear the sheet | "Three branches, one app: frontend is the product, backend is the data, ai-maps is the intelligence. Everything you clicked is in the repo." |

## If something goes wrong

- **Submit says "AI alignment is unavailable…"** — no key, or the model refused. Keep going: the route is still saved and drawn as a straight line. Say: "the AI step is best-effort by design; the route never fails to save." Then show the keyed path if you can fix it between judges.
- **Submit is slow (>20 s)** — Gemini is retrying a second model, then gives up. Talk over it; the button is honest about what it is doing.
- **A place is not found** — the row is saved without being drawn. Say so and retry with `Majestic Bus Station, Bengaluru`, which is known good.
- **Port 3000 busy** — Next prints the real port; use the URL it prints.
- **Tour appears anyway** (different browser profile) — press **Skip** immediately and carry on from 0:08.

## Between rehearsals

`rm -rf .data` clears community routes and bookings from the local file store. With Supabase, use
`delete from public.routes; delete from public.bookings;` in the SQL editor.
