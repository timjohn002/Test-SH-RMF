// Coordinate conversions for Keenon maps. Three spaces:
//  - robot metres: what the robot reports (location API, callbacks); y up.
//  - map pixels:   Keenon's named points; pixels from the map origin (bottom-left), y up.
//  - image pixels: the PNG as displayed; (0,0) at the top-left, y down.

import type { PlanCalibration, Point } from '../../lib/coords'
import { KEENON_MAP_RESOLUTION } from './shared'

export interface KeenonMapFrame {
  map_height: number
  origin_x_m: number
  origin_y_m: number
}

export function mapPixelToMeters(map: KeenonMapFrame, p: Point, resolution = KEENON_MAP_RESOLUTION): Point {
  return { x: map.origin_x_m + p.x * resolution, y: map.origin_y_m + p.y * resolution }
}

export function metersToMapPixel(map: KeenonMapFrame, m: Point, resolution = KEENON_MAP_RESOLUTION): Point {
  return { x: (m.x - map.origin_x_m) / resolution, y: (m.y - map.origin_y_m) / resolution }
}

/** Map pixel (y up from the origin) → image pixel (y down from the top). */
export function mapPixelToImage(map: KeenonMapFrame, p: Point): Point {
  return { x: p.x, y: map.map_height - p.y }
}

/**
 * Calibration that lets the generic PlanMap show a Keenon map with its cursor readout
 * in robot metres (PlanMap's world frame = the robot's frame).
 */
export function keenonMapCalibration(map: KeenonMapFrame, resolution = KEENON_MAP_RESOLUTION): PlanCalibration {
  return {
    scale_m_per_px: resolution,
    origin_x_px: -map.origin_x_m / resolution,
    origin_y_px: map.map_height + map.origin_y_m / resolution,
  }
}
