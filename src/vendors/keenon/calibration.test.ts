import { describe, expect, it } from 'vitest'
import {
  fitTransform,
  headingOnPlan,
  pairErrors,
  planToRobot,
  robotToPlan,
  scaleDeviation,
  type CalibrationPair,
  type PlanTransform,
} from './calibration'

const T: PlanTransform = { scale: 20, rotation: Math.PI / 6, origin_x: 200, origin_y: 300 }
const ROBOT = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 0, y: 4 },
  { x: -3, y: 2 },
]
const pairsFor = (t: PlanTransform, robots = ROBOT): CalibrationPair[] =>
  robots.map((robot) => ({ robot, plan: robotToPlan(t, robot) }))

function expectTransform(actual: PlanTransform, expected: PlanTransform) {
  expect(actual.scale).toBeCloseTo(expected.scale, 6)
  expect(Math.cos(actual.rotation)).toBeCloseTo(Math.cos(expected.rotation), 6)
  expect(Math.sin(actual.rotation)).toBeCloseTo(Math.sin(expected.rotation), 6)
  expect(actual.origin_x).toBeCloseTo(expected.origin_x, 6)
  expect(actual.origin_y).toBeCloseTo(expected.origin_y, 6)
}

describe('robotToPlan / planToRobot', () => {
  it('flips y: robot "up" is plan "up" (smaller pixel y) when unrotated', () => {
    const t = { scale: 20, rotation: 0, origin_x: 100, origin_y: 100 }
    expect(robotToPlan(t, { x: 1, y: 1 })).toEqual({ x: 120, y: 80 })
  })

  it('round-trips', () => {
    const p = { x: -1.47, y: -1.26 }
    const back = planToRobot(T, robotToPlan(T, p))
    expect(back.x).toBeCloseTo(p.x)
    expect(back.y).toBeCloseTo(p.y)
  })
})

describe('fitTransform', () => {
  it('recovers the transform exactly from 2 pairs', () => {
    const fit = fitTransform(pairsFor(T, ROBOT.slice(0, 2)))
    expectTransform(fit.transform, T)
    expect(fit.rms_m).toBeLessThan(1e-9)
  })

  it.each([0, Math.PI / 2, Math.PI, -2.5])('handles rotation %f', (rotation) => {
    const t = { ...T, rotation }
    expectTransform(fitTransform(pairsFor(t)).transform, t)
  })

  it('fits noisy pairs and flags an outlier', () => {
    const noisy = pairsFor(T).map((p, i) => ({ ...p, plan: { x: p.plan.x + (i % 2 ? 1 : -1), y: p.plan.y + 1 } }))
    const wrong = { robot: { x: 6, y: 6 }, plan: { x: 20, y: 20 } } // clicked in the wrong place
    const fit = fitTransform([...noisy, wrong, ...pairsFor(T, [{ x: 2, y: -3 }])])
    expect(fit.errors.findIndex((e) => e.outlier)).toBe(4)
    expect(fit.errors.filter((e) => e.outlier)).toHaveLength(1)
  })

  it('reports errors in robot metres', () => {
    const fit = fitTransform(pairsFor(T).map((p, i) => (i === 3 ? { ...p, plan: { x: p.plan.x + 40, y: p.plan.y } } : p)))
    expect(fit.rms_m).toBeGreaterThan(0.3)
    expect(pairErrors(T, pairsFor(T)).rms_m).toBeCloseTo(0)
  })

  it('rejects too few or clustered pairs', () => {
    expect(() => fitTransform(pairsFor(T, ROBOT.slice(0, 1)))).toThrow(/At least 2/)
    expect(() => fitTransform(pairsFor(T, [{ x: 1, y: 1 }, { x: 1.1, y: 1 }]))).toThrow(/too close/)
    expect(() =>
      fitTransform([
        { robot: { x: 0, y: 0 }, plan: { x: 5, y: 5 } },
        { robot: { x: 5, y: 0 }, plan: { x: 5, y: 5 } },
      ]),
    ).toThrow(/same place/)
  })
})

describe('headingOnPlan / scaleDeviation', () => {
  it('adds the rotation to the heading', () => {
    expect(headingOnPlan(T, 0.5)).toBeCloseTo(0.5 + Math.PI / 6)
  })

  it('compares the fitted scale with the floor plan calibration', () => {
    expect(scaleDeviation({ ...T, scale: 20 }, 0.05)).toBeCloseTo(0)
    expect(scaleDeviation({ ...T, scale: 21 }, 0.05)).toBeCloseTo(0.05)
  })
})
