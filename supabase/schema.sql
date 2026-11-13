-- Shared free-text routes submitted from the map's Community Routes panel.
create extension if not exists "pgcrypto";

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  description text,
  created_at timestamptz not null default now(),
  origin_lat double precision,
  origin_lng double precision,
  dest_lat double precision,
  dest_lng double precision
);

alter table public.routes
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists dest_lat double precision,
  add column if not exists dest_lng double precision;

alter table public.routes enable row level security;
drop policy if exists "Routes are publicly readable" on public.routes;
create policy "Routes are publicly readable" on public.routes for select using (true);
drop policy if exists "Anyone can log a route" on public.routes;
create policy "Anyone can log a route" on public.routes for insert with check (
  length(btrim(origin)) between 1 and 120
  and length(btrim(destination)) between 1 and 120
  and coalesce(length(description), 0) <= 600
);
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

-- Writes go through the server route handlers using the service role key, so
-- no anon policies are granted here.
alter table public.bookings enable row level security;
