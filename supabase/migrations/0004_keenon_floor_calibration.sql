-- Keenon floor calibration: the transform from a robot's map (robot metres) to the
-- matched app floor plan (pixels). Run after 0003_keenon_robot_maps.sql.

alter table public.keenon_robot_floors
  add column if not exists calib_scale_px_per_m double precision,  -- plan pixels per robot metre
  add column if not exists calib_rotation_rad   double precision,
  add column if not exists calib_origin_x_px    double precision,  -- plan pixel of the robot origin
  add column if not exists calib_origin_y_px    double precision,
  add column if not exists calib_pairs          jsonb,             -- [{ robot: {x,y}, plan: {x,y}, point_name? }]
  add column if not exists calib_rms_m          double precision,  -- average pair error, robot metres
  add column if not exists calib_map_hash       text,              -- Keenon map version it was made against
  add column if not exists calibrated_at        timestamptz;
