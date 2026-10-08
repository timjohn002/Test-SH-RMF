// Calibration between a Keenon robot map (robot metres, y up) and an app floor plan (pixels, y down).
//
// Transform (similarity: rotation θ, scale s in plan pixels per robot metre, offset):
//   px = ox + s·(cosθ·x − sinθ·y)
//   py = oy − s·(sinθ·x + cosθ·y)
// Fitted with complex numbers: z = x + iy (robot), w = px − i·py (plan, y flipped up),
// w = a·z + b with a = s·e^{iθ}, b = ox − i·oy. Pure; shared by browser and server.

import type { Point } from '../../lib/coords'

export interface PlanTransform {
  /** Plan pixels per robot metre. */
  scale: number
  /** Radians, counter-clockwise from the robot's x axis to the plan's x axis. */
  rotation: number
  /** Plan pixel of the robot map's origin (0, 0). */
  origin_x: number
  origin_y: number
}

export interface CalibrationPair {
  robot: Point
  plan: Point
  /** Keenon named point the robot side was snapped to, if any. */
  point_name?: string | null
}

export interface PairError {
  /** Distance between where the transform puts the robot point and where it was clicked, in robot metres. */
  error_m: number
  /** Likely misplaced (much worse than the others). */
  outlier: boolean
}

export interface FitResult {
  transform: PlanTransform
  errors: PairError[]
  rms_m: number
}

/** Pairs closer than this (robot metres) can't define a rotation. */
export const MIN_PAIR_SPREAD_M = 0.5

export function robotToPlan(t: PlanTransform, p: Point): Point {
  const c = Math.cos(t.rotation)
  const s = Math.sin(t.rotation)
  return {
    x: t.origin_x + t.scale * (c * p.x - s * p.y),
    y: t.origin_y - t.scale * (s * p.x + c * p.y),
  }
}

export function planToRobot(t: PlanTransform, p: Point): Point {
  const u = (p.x - t.origin_x) / t.scale
  const v = (t.origin_y - p.y) / t.scale
  const c = Math.cos(t.rotation)
  const s = Math.sin(t.rotation)
  return { x: c * u + s * v, y: -s * u + c * v }
}

/** Robot heading (radians, y up) → heading on the plan (radians, y up). */
export function headingOnPlan(t: PlanTransform, headingRad: number): number {
  return headingRad + t.rotation
}

/** How far the fitted scale is from the floor plan's own metre calibration (0.05 = 5% larger). */
export function scaleDeviation(t: PlanTransform, floorScaleMPerPx: number): number {
  const expectedPxPerM = 1 / floorScaleMPerPx
  return t.scale / expectedPxPerM - 1
}

/** Distance (robot metres) between where the transform puts the pair's robot point and its plan click. */
function pairError(t: PlanTransform, pair: CalibrationPair): number {
  const p = robotToPlan(t, pair.robot)
  return Math.hypot(p.x - pair.plan.x, p.y - pair.plan.y) / t.scale
}

const rmsOf = (values: number[]) =>
  values.length ? Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length) : 0

/**
 * Error of each pair under a transform (also used for hand-tuned transforms).
 * Outliers use leave-one-out: a pair is flagged when the other pairs agree with each other
 * but not with it. Needs 4+ pairs; with 3, any one pair could be the wrong one.
 */
export function pairErrors(t: PlanTransform, pairs: CalibrationPair[]): { errors: PairError[]; rms_m: number } {
  const meters = pairs.map((pair) => pairError(t, pair))
  const outliers = pairs.map((pair, i) => {
    if (pairs.length < 4) return false
    const rest = pairs.filter((_, j) => j !== i)
    try {
      const restFit = fitCore(rest)
      const restRms = rmsOf(rest.map((p) => pairError(restFit, p)))
      const own = pairError(restFit, pair)
      return own > 0.5 && own > 3 * Math.max(restRms, 0.1)
    } catch {
      return false
    }
  })
  return {
    errors: meters.map((m, i) => ({ error_m: m, outlier: outliers[i] })),
    rms_m: rmsOf(meters),
  }
}

/** Least-squares similarity fit, with errors and outliers. Throws if the pairs can't define a transform. */
export function fitTransform(pairs: CalibrationPair[]): FitResult {
  const transform = fitCore(pairs)
  return { transform, ...pairErrors(transform, pairs) }
}

function fitCore(pairs: CalibrationPair[]): PlanTransform {
  if (pairs.length < 2) throw new Error('At least 2 point pairs are needed')

  const n = pairs.length
  const zx = pairs.reduce((s, p) => s + p.robot.x, 0) / n
  const zy = pairs.reduce((s, p) => s + p.robot.y, 0) / n
  const wx = pairs.reduce((s, p) => s + p.plan.x, 0) / n
  const wy = pairs.reduce((s, p) => s - p.plan.y, 0) / n // w uses -py

  // a = Σ (w - w̄)·conj(z - z̄) / Σ |z - z̄|²
  let num_re = 0
  let num_im = 0
  let den = 0
  for (const p of pairs) {
    const dzx = p.robot.x - zx
    const dzy = p.robot.y - zy
    const dwx = p.plan.x - wx
    const dwy = -p.plan.y - wy
    num_re += dwx * dzx + dwy * dzy
    num_im += dwy * dzx - dwx * dzy
    den += dzx * dzx + dzy * dzy
  }
  const spread = Math.sqrt(den / n)
  if (spread < MIN_PAIR_SPREAD_M / 2) {
    throw new Error('The robot-side points are too close together. Spread them across the floor.')
  }
  const a_re = num_re / den
  const a_im = num_im / den
  const scale = Math.hypot(a_re, a_im)
  if (!(scale > 1e-6)) throw new Error('The plan-side points are all in the same place.')

  // b = w̄ - a·z̄
  const b_re = wx - (a_re * zx - a_im * zy)
  const b_im = wy - (a_re * zy + a_im * zx)
  return { scale, rotation: Math.atan2(a_im, a_re), origin_x: b_re, origin_y: -b_im }
}
