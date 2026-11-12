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
