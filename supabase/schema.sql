-- Ghost Routes — logged routes table.
-- Run this in the Supabase SQL editor, then set SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY (or an anon key with insert/select policies).

create extension if not exists "pgcrypto";

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  route_name text not null,
  vehicle_type text not null default 'Shared Auto',
  estimated_fare text not null default 'Unknown',
  frequency text not null default 'Unknown',
  stops jsonb not null default '[]'::jsonb,
  path_coordinates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists routes_created_at_idx on public.routes (created_at desc);

alter table public.routes enable row level security;

-- Anyone may read logged routes (they are public transit data).
drop policy if exists "routes are readable" on public.routes;
create policy "routes are readable" on public.routes
  for select using (true);

-- Writes go through /api/routes. With a service-role key RLS is bypassed; with
-- an anon key, allow inserts explicitly.
drop policy if exists "routes are insertable" on public.routes;
create policy "routes are insertable" on public.routes
  for insert with check (true);
