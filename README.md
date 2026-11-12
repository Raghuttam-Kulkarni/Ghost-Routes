# 👻 Ghost Routes

> **AI-powered informal public transport route discovery platform.**

---

## 📌 Overview

Ever tried taking a shared auto, local minibus, or informal transport route only to realize it isn't listed on standard navigation apps? **Ghost Routes** bridges this gap by bringing undocumented, community-driven transit networks into the digital age.

---

## 🎯 The Problem

Shared autos, minibuses, and local transit options form the backbone of daily commutes in many regions. However, these routes are often **undocumented, hyper-local, and completely missing** from existing navigation platforms, leaving commuters reliant purely on word-of-mouth.

---

## 🚀 The Solution

**Ghost Routes** enables local communities to submit, discover, and visualize informal transit paths. By leveraging crowdsourced data alongside **AI-powered route normalization**, we transform chaotic, informal travel paths into clear, reliable, interactive routes.

---

## ✨ Key Features

- 📌 **Route Submission:** Empowers users to report and map informal transit pathways effortlessly.
- 🔍 **Smart Route Search:** Find local travel options ignored by mainstream map tools.
- 🗺️ **Interactive Map View:** Rich visual mapping for real-time clarity.
- 🤖 **AI Route Standardization:** Automatically cleans up, connects, and structures crowdsourced GPS inputs.
- 🎯 **Confidence Scoring:** Validates route reliability based on community feedback and data points.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js / React, Tailwind CSS
- **Backend & Database:** Supabase
- **AI & ML:** Gemini API
- **Mapping:** Leaflet / OpenStreetMap

---

## 👥 The Team

| Name | Role |
| :--- | :--- |
| **Member 1** | Frontend Lead |
| **Member 2** | Backend & Database Lead |
| **Member 3** | AI Integration & Mapping Lead |

---

## ⚡ Quick Start

```bash
git clone https://github.com/Raghuttam-Kulkarni/Ghost-Routes.git
cd Ghost-Routes
npm install
cp .env.example .env.local   # add your keys, see below
npm run dev                  # http://localhost:3000
```

For the Supabase-backed setup, run `supabase/schema.sql` once in the SQL editor and set
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Set `GEMINI_API_KEY` to turn on
live AI normalization. With none of them the app still runs, persisting to `.data/`.

### Demo checklist

1. The curated routes are on the map: open one, check upcoming departures, rate a pickup.
2. **Share a route**: `Majestic Bus Station, Bengaluru` → `Forum Mall, Koramangala, Bengaluru`,
   details `shared auto via Sony World Signal, INR 25, every 10 mins`. With `GEMINI_API_KEY` set the
   saved row comes back with an AI route name, stops and a road-snapped line; click the line for it.
3. **Sign in** (top right) → request a seat → **My bookings** shows the ticket code.
4. AI check without the UI: `curl -s -X POST localhost:3000/api/normalize-route -H 'content-type: application/json' -d '{"rawInput":"shared auto from Majestic to Koramangala"}'`
   — `"isFallback": false` means the live model answered.

## Community route submissions

The curated transit network remains the source for search, detailed route information, and seat requests. Community submissions are shown on the same map as their own layer. Copy `.env.example` to `.env.local`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then run `supabase/schema.sql` in the Supabase SQL editor. Without Supabase the app keeps working against a local `.data/community-routes.json` file, the same fallback bookings use.

## How the three parts fit

The user interface is the frontend app, unchanged: map, search, route sheets, tours, community panel, sign-in and bookings.

| Part | Role in this app |
| --- | --- |
| `frontend` | Every screen and map layer in `app/` and `components/` |
| `backend` | Postgres/Supabase storage (`lib/community-route-store.ts`, `lib/supabase.ts`), place geocoding (`lib/geocode.ts`) and distance helpers (`lib/geo.ts`) |
| `ai-maps` | Route AI: `lib/normalize-route.ts`, `lib/snapToRoads.ts` and `POST /api/normalize-route` — no ai-maps UI is used |

A `POST /api/routes` from the community panel runs the whole pipeline:

1. Nominatim resolves the origin and destination (backend) at the same time as Gemini turns the rider's notes into a route name, vehicle, fare, frequency and ordered stops (ai-maps).
2. OSRM replaces the model's rough polyline with real street geometry, capped at 3 s; if it fails the model's own path is kept.
3. `stops` and `path` are stored as JSON alongside the geocoded endpoints (Supabase, or the local file fallback).
4. The map draws the road-snapped line with its stops. Rows saved before the AI step, or when no `GEMINI_API_KEY` is set, stay straight dashed connections.

Set `GEMINI_API_KEY` to enable live normalization. Without it, `/api/normalize-route` serves its built-in demo route and community submissions are saved as plain geocoded lines rather than canned routes.
