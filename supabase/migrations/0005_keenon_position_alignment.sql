-- Keenon position alignment: Keenon's location API reports positions in a frame that differs
-- from its map image (seen: rotated 180° and shifted). This stores, per robot floor, the rigid
-- transform from reported positions to the map frame. Run after 0004.

alter table public.keenon_robot_floors
  add column if not exists align_rotation_rad double precision,
  add column if not exists align_offset_x_m   double precision,   -- map metres
  add column if not exists align_offset_y_m   double precision,
  add column if not exists align_mirror       boolean,
  add column if not exists align_samples      jsonb,               -- [{ reported: {x,y}, map: {x,y} }]
  add column if not exists align_rms_m        double precision,
  add column if not exists aligned_at         timestamptz;
