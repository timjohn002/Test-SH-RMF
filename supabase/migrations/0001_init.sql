-- Starhub RMF initial schema.
-- Run once in Supabase -> SQL Editor (or `supabase db push`).
--
-- All access goes through Netlify Functions using the service-role key.
-- RLS is enabled with NO policies, so the public anon/publishable key can read nothing.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Users (custom auth, no email). Usernames are stored lowercase.
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id              uuid primary key default gen_random_uuid(),
  username        text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  password_hash   text not null,
  role            text not null default 'user' check (role in ('admin', 'user')),
  failed_attempts int  not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

alter table public.app_users enable row level security;

-- ---------------------------------------------------------------------------
-- Floors and floor plans
-- ---------------------------------------------------------------------------
create table if not exists public.floors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  level           int  not null unique,
  elevation_m     numeric not null default 0,
  plan_path       text,
  plan_width_px   int,
  plan_height_px  int,
  scale_m_per_px  numeric not null default 0.05 check (scale_m_per_px > 0),
  origin_x_px     numeric not null default 0,
  origin_y_px     numeric not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.floors enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists floors_set_updated_at on public.floors;
create trigger floors_set_updated_at
  before update on public.floors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage: private bucket for floor plan images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'floor-plans',
  'floor-plans',
  false,
  52428800, -- 50 MB
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;
