-- Ghost Routes schema for Supabase.
-- Run this once in the Supabase dashboard -> SQL Editor.
--
-- Row shape shared by the frontend's Community Routes panel and the backend's
-- geocoder; the second block is filled in by the ai-maps normalizer.

create extension if not exists "pgcrypto";

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Coordinates are needed to draw a route on the map. They are filled in by
-- /api/routes when the place names resolve, and stay null when they do not.
-- The app reads/writes dest_lat / dest_lng (not destination_lat / _lng).
alter table public.routes
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists dest_lat double precision,
  add column if not exists dest_lng double precision;

-- AI-normalized route (ai-maps module): name, vehicle, fare, running frequency,
-- ordered stops and the road-snapped polyline used by the frontend map.
alter table public.routes
  add column if not exists ai_normalized boolean not null default false,
  add column if not exists route_name text,
  add column if not exists vehicle_type text,
  add column if not exists estimated_fare text,
  add column if not exists frequency text,
  add column if not exists stops jsonb,
  add column if not exists path jsonb;

-- Path/stops are plain JSON arrays: [[lat, lng], ...] and
-- [{ "name": text, "lat": number, "lng": number }, ...].
comment on column public.routes.path is 'Road-snapped route geometry as [[lat, lng], ...]';
comment on column public.routes.stops is 'Ordered AI-normalized stops as [{ name, lat, lng }, ...]';

alter table public.routes enable row level security;

drop policy if exists "Routes are publicly readable" on public.routes;
create policy "Routes are publicly readable"
  on public.routes for select
  using (true);

drop policy if exists "Anyone can log a route" on public.routes;
create policy "Anyone can log a route"
  on public.routes for insert
  with check (
    length(btrim(origin)) between 1 and 120
    and length(btrim(destination)) between 1 and 120
    and coalesce(length(description), 0) <= 600
  );

-- Seat requests (frontend).
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  route_id text not null,
  board_stop_id text not null,
  alight_stop_id text not null,
  departure_time timestamptz not null,
  seats integer not null check (seats between 1 and 4),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists bookings_user_departure_idx
  on public.bookings (user_id, departure_time desc);
