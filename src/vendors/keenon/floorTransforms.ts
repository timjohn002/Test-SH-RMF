import type { Point } from '../../lib/coords'
import type { RobotPosition } from '../../types/api'
import { alignHeading, alignPosition, type PositionAlignment } from './alignment'
import type { PlanTransform } from './calibration'
import type { KeenonRobotFloor } from './shared'

/** The saved position alignment of a floor, or null if it isn't aligned. */
export function floorAlignment(
  floor: Pick<KeenonRobotFloor, 'align_rotation_rad' | 'align_offset_x_m' | 'align_offset_y_m' | 'align_mirror'>,
): PositionAlignment | null {
  const { align_rotation_rad: rotation, align_offset_x_m: x, align_offset_y_m: y } = floor
  // `!= null`: the columns are absent (undefined) until migration 0005 has run.
  return rotation != null && x != null && y != null
    ? { rotation, offset_x: x, offset_y: y, mirror: !!floor.align_mirror }
    : null
}

/** The saved plan calibration of a floor, or null if it isn't calibrated. */
export function floorCalibration(
  floor: Pick<KeenonRobotFloor, 'calib_scale_px_per_m' | 'calib_rotation_rad' | 'calib_origin_x_px' | 'calib_origin_y_px'>,
): PlanTransform | null {
  const { calib_scale_px_per_m: scale, calib_rotation_rad: rotation, calib_origin_x_px: ox, calib_origin_y_px: oy } = floor
  return scale != null && rotation != null && ox != null && oy != null
    ? { scale, rotation, origin_x: ox, origin_y: oy }
    : null
}

/** A robot position in Keenon map metres, heading in the map frame. */
export interface AlignedRobot {
  point: Point
  heading: number | null
}

/** A reported robot position in Keenon map metres (heading in the map frame too). */
export function alignedRobot(a: PositionAlignment, position: RobotPosition): AlignedRobot {
  return {
    point: alignPosition(a, position),
    heading: position.heading_rad !== null ? alignHeading(a, position.heading_rad) : null,
  }
}
