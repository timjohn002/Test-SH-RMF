-- Robot vendor integrations (Keenon first).
-- Run once in Supabase -> SQL Editor, after 0001_init.sql.
--
-- Same model as 0001: RLS enabled with NO policies; only Netlify Functions
-- (service-role key) can read or write these tables.

-- ---------------------------------------------------------------------------
-- One row per supported vendor (vendor ids come from the code registry).
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_configs (
  vendor            text primary key,
  enabled           boolean not null default false,
  settings          jsonb not null default '{}'::jsonb,  -- non-secret, vendor-specific
  secrets           jsonb not null default '{}'::jsonb,  -- never returned to the browser
  webhook_token     text not null,                       -- secret part of the callback URL
  access_token      text,                                -- cached vendor API token
  token_expires_at  timestamptz,
  last_sync_at      timestamptz,
  last_sync_error   text,
  last_callback_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.vendor_configs enable row level security;

drop trigger if exists vendor_configs_set_updated_at on public.vendor_configs;
create trigger vendor_configs_set_updated_at
  before update on public.vendor_configs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vendor-side sites ("stores" in Keenon terms).
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_stores (
  vendor       text not null,
  external_id  text not null,
  name         text,
  brand        text,
  address      text,
  country      text,
  synced_at    timestamptz not null default now(),
  primary key (vendor, external_id)
);

alter table public.vendor_stores enable row level security;

-- ---------------------------------------------------------------------------
-- Robots from every vendor, normalized.
-- ---------------------------------------------------------------------------
create table if not exists public.robots (
  id                 uuid primary key default gen_random_uuid(),
  vendor             text not null,
  external_id        text not null,           -- vendor's robot id / serial number
  store_external_id  text,
  name               text,
  model              text,
  app_version        text,
  online             boolean,
  online_type        text,
  battery            int,
  charging           boolean,
  work_state         text not null default 'unknown'
                     check (work_state in ('idle','busy','charging','operating','scheduling','starting','offline','unknown')),
  can_be_called      boolean,
  current_task       jsonb,                   -- latest task callback, normalized
  vendor_status      jsonb,                   -- vendor-specific detail (e.g. cleaning hardware)
  last_seen_at       timestamptz,             -- last callback mentioning this robot
  last_refreshed_at  timestamptz,             -- last on-demand status pull
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (vendor, external_id)
);

alter table public.robots enable row level security;

drop trigger if exists robots_set_updated_at on public.robots;
create trigger robots_set_updated_at
  before update on public.robots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Every vendor callback received (kept 30 days by a scheduled function).
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_events (
  id                 uuid primary key default gen_random_uuid(),
  vendor             text not null,
  received_at        timestamptz not null default now(),
  event_type         text not null,
  robot_external_id  text,
  signature          text not null check (signature in ('valid','invalid','missing','not_checked')),
  signature_detail   text,
  headers            jsonb,
  body               jsonb,
  body_text          text,
  status             text not null check (status in ('processed','ignored','rejected','failed')),
  error              text,
  duration_ms        int
);

create index if not exists vendor_events_vendor_received_idx
  on public.vendor_events (vendor, received_at desc);

alter table public.vendor_events enable row level security;
