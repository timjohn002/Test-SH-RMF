// Position alignment: Keenon's location API reports positions in a frame that differs from
// its map image's frame (seen: rotated 180° and shifted; offsets change when the robot
// relocalizes). This converts a reported position into map metres:
//
//   map = R(θ) · M · reported + t      M = identity, or a mirror in y when `mirror`
//
// Rigid (no scale): both frames are in metres. Pure; shared by browser and server.

import type { Point } from '../../lib/coords'

export interface PositionAlignment {
  /** Radians. */
  rotation: number
  /** Metres, in the map frame. */
  offset_x: number
  offset_y: number
  mirror: boolean
}

export interface AlignmentSample {
  /** What the location API reported. */
  reported: Point
  /** Where the robot really was on Keenon's map (map metres). */
  map: Point
}

export interface AlignmentFit {
  alignment: PositionAlignment
  errors_m: number[]
  rms_m: number
}

/** The usual Keenon case: rotated 180°. */
export const DEFAULT_ROTATION = Math.PI

const mirrored = (p: Point, mirror: boolean): Point => (mirror ? { x: p.x, y: -p.y } : p)

export function alignPosition(a: PositionAlignment, reported: Point): Point {
  const p = mirrored(reported, a.mirror)
  const c = Math.cos(a.rotation)
  const s = Math.sin(a.rotation)
  return { x: c * p.x - s * p.y + a.offset_x, y: s * p.x + c * p.y + a.offset_y }
}

/** Reported heading (radians) → heading in the map frame. */
export function alignHeading(a: PositionAlignment, headingRad: number): number {
  return (a.mirror ? -headingRad : headingRad) + a.rotation
}

export function sampleErrors(a: PositionAlignment, samples: AlignmentSample[]): { errors_m: number[]; rms_m: number } {
  const errors_m = samples.map((s) => {
    const p = alignPosition(a, s.reported)
    return Math.hypot(p.x - s.map.x, p.y - s.map.y)
  })
  const rms_m = errors_m.length ? Math.sqrt(errors_m.reduce((sum, e) => sum + e * e, 0) / errors_m.length) : 0
  return { errors_m, rms_m }
}

/** Offset that puts one sample exactly in place, for a chosen rotation/mirror. */
export function offsetFromOneSample(
  rotation: number,
  mirror: boolean,
  sample: AlignmentSample,
): PositionAlignment {
  const rotated = alignPosition({ rotation, mirror, offset_x: 0, offset_y: 0 }, sample.reported)
  return { rotation, mirror, offset_x: sample.map.x - rotated.x, offset_y: sample.map.y - rotated.y }
}

/** Least-squares rotation + offset (scale fixed at 1). Needs 2+ well-separated samples. */
export function fitRigid(samples: AlignmentSample[], mirror: boolean): AlignmentFit {
  if (samples.length < 2) throw new Error('At least 2 samples are needed to fit the rotation')
  const zs = samples.map((s) => mirrored(s.reported, mirror))
  const n = samples.length
  const zx = zs.reduce((t, z) => t + z.x, 0) / n
  const zy = zs.reduce((t, z) => t + z.y, 0) / n
  const wx = samples.reduce((t, s) => t + s.map.x, 0) / n
  const wy = samples.reduce((t, s) => t + s.map.y, 0) / n

  // a ∝ Σ (w − w̄)·conj(z − z̄), normalized to |a| = 1 (pure rotation).
  let re = 0
  let im = 0
  let spread = 0
  samples.forEach((s, i) => {
    const dzx = zs[i].x - zx
    const dzy = zs[i].y - zy
    const dwx = s.map.x - wx
    const dwy = s.map.y - wy
    re += dwx * dzx + dwy * dzy
    im += dwy * dzx - dwx * dzy
    spread += dzx * dzx + dzy * dzy
  })
  if (Math.sqrt(spread / n) < 0.25) {
    throw new Error('The samples are too close together. Move the robot at least a metre between samples.')
  }
  const rotation = Math.atan2(im, re)
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  const alignment: PositionAlignment = {
    rotation,
    mirror,
    offset_x: wx - (c * zx - s * zy),
    offset_y: wy - (s * zx + c * zy),
  }
  return { alignment, ...sampleErrors(alignment, samples) }
}

/**
 * Fit with and without mirroring. With 3+ samples a mirror can be told apart from a
 * rotation; suggest it only when it fits clearly better.
 */
export function fitBestRigid(samples: AlignmentSample[]): {
  plain: AlignmentFit
  mirrored: AlignmentFit | null
  suggestMirror: boolean
} {
  const plain = fitRigid(samples, false)
  if (samples.length < 3) return { plain, mirrored: null, suggestMirror: false }
  const mirroredFit = fitRigid(samples, true)
  const suggestMirror = mirroredFit.rms_m < plain.rms_m * 0.5 && plain.rms_m > 0.1
  return { plain, mirrored: mirroredFit, suggestMirror }
}
