-- Ghost-Routes schema for Supabase.
-- Run this in the Supabase dashboard -> SQL Editor.

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
