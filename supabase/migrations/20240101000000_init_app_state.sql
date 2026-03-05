-- Migration: Initialize app_state table
-- This table stores the entire application state as a single JSONB record.
-- The app upserts one row with id = 'default' containing profiles, sequences, and sessions.

create table if not exists public.app_state (
  id   text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Automatically update updated_at on every write
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_state_set_updated_at
  before update on public.app_state
  for each row
  execute function public.set_updated_at();

-- Seed the default row so reads always return a result instead of an empty array
insert into public.app_state (id, payload)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

-- Row-level security: enable RLS but allow full access via the anon key
-- (The app authenticates with the anon key directly; no user auth is involved.)
alter table public.app_state enable row level security;

create policy "anon full access"
  on public.app_state
  for all
  to anon
  using (true)
  with check (true);
