-- Keenon robot maps: each robot's scene, the floors (maps) in that scene, and
-- which app floor plan each Keenon floor matches. Run after 0002_vendors.sql.
-- Same model as before: RLS enabled with NO policies (service-role access only).

-- Last known robot position, whatever the source (vendor-agnostic).
-- { floor, x, y, heading_rad, reported_at, source }
alter table public.robots add column if not exists position jsonb;

-- ---------------------------------------------------------------------------
-- Which Keenon scene a robot uses (detected, or overridden by an admin).
-- ---------------------------------------------------------------------------
create table if not exists public.keenon_robot_scenes (
  robot_id             uuid primary key references public.robots(id) on delete cascade,
  detected_scene_code  text,
  detected_scene_name  text,
  manual_scene_code    text,
  manual_scene_name    text,
  discovered_at        timestamptz,
  discovery_error      text,
  updated_at           timestamptz not null default now()
);

alter table public.keenon_robot_scenes enable row level security;

drop trigger if exists keenon_robot_scenes_set_updated_at on public.keenon_robot_scenes;
create trigger keenon_robot_scenes_set_updated_at
  before update on public.keenon_robot_scenes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- One row per robot, scene and Keenon floor: the cached Keenon map, its named
-- points, and the app floor plan an admin matched it to.
-- ---------------------------------------------------------------------------
create table if not exists public.keenon_robot_floors (
  id            uuid primary key default gen_random_uuid(),
  robot_id      uuid not null references public.robots(id) on delete cascade,
  scene_code    text not null,
  floor         int  not null,
  floor_label   text,                 -- Keenon floorInfo, e.g. "Office"
  building      text,                 -- Keenon buildingInfo, e.g. "A"
  map_png       text,                 -- base64 PNG from Keenon (cached for the live site)
  map_width     int,
  map_height    int,
  origin_x_m    double precision,     -- map origin (bottom-left), robot metres
  origin_y_m    double precision,
  is_dynamic    boolean,
  points        jsonb not null default '[]'::jsonb,
  map_versions  text[] not null default '{}',   -- distinct mapMd5 values of the points
  sources       text[] not null default '{}',   -- how the floor was found
  last_seen_at  timestamptz not null default now(),
  app_floor_id  uuid references public.floors(id) on delete set null,
  matched_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (robot_id, scene_code, floor)
);

alter table public.keenon_robot_floors enable row level security;

drop trigger if exists keenon_robot_floors_set_updated_at on public.keenon_robot_floors;
create trigger keenon_robot_floors_set_updated_at
  before update on public.keenon_robot_floors
  for each row execute function public.set_updated_at();
