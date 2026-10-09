import { describe, expect, it } from 'vitest'
import {
  alignHeading,
  alignPosition,
  fitBestRigid,
  fitRigid,
  offsetFromOneSample,
  type AlignmentSample,
  type PositionAlignment,
} from './alignment'

// Measured data from robot_coordinate_conversion_summary.md (Robot 2): reported → true map position.
const ROBOT2: AlignmentSample[] = [
  { reported: { x: 0.47, y: 2.97 }, map: { x: 2.14, y: 1.67 } },
  { reported: { x: 0.47, y: 0.41 }, map: { x: 2.14, y: 4.19 } },
  { reported: { x: -0.95, y: 1.14 }, map: { x: 3.55, y: 3.47 } },
]

const deg = (r: number) => (((r * 180) / Math.PI) % 360 + 360) % 360

describe('fitRigid', () => {
  it("reproduces Robot 2's conversion (2.61 − x, 4.62 − y) within 3 cm", () => {
    const fit = fitRigid(ROBOT2, false)
    expect(deg(fit.alignment.rotation)).toBeCloseTo(180, 0)
    expect(fit.alignment.offset_x).toBeCloseTo(2.61, 1)
    expect(fit.alignment.offset_y).toBeCloseTo(4.62, 1)
    expect(fit.rms_m).toBeLessThan(0.03)
    // A new reported point converts like the notes' formula.
    const p = alignPosition(fit.alignment, { x: 1, y: 1 })
    expect(p.x).toBeCloseTo(1.61, 1)
    expect(p.y).toBeCloseTo(3.62, 1)
  })

  it('rejects samples that are too close together', () => {
    expect(() =>
      fitRigid(
        [
          { reported: { x: 0, y: 0 }, map: { x: 1, y: 1 } },
          { reported: { x: 0.1, y: 0 }, map: { x: 0.9, y: 1 } },
        ],
        false,
      ),
    ).toThrow(/too close/)
    expect(() => fitRigid(ROBOT2.slice(0, 1), false)).toThrow(/At least 2/)
  })
})

describe('Robot 1 (C40): map = −(reported + (1.47, 1.26))', () => {
  const robot1: PositionAlignment = { rotation: Math.PI, mirror: false, offset_x: -1.47, offset_y: -1.26 }

  it('puts the docked C40 (reported −1.47, −1.26) at the map origin', () => {
    const p = alignPosition(robot1, { x: -1.47, y: -1.26 })
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('is recovered from a single sample with the 180° preset', () => {
    const one = offsetFromOneSample(Math.PI, false, { reported: { x: -1.47, y: -1.26 }, map: { x: 0, y: 0 } })
    expect(one.offset_x).toBeCloseTo(-1.47)
    expect(one.offset_y).toBeCloseTo(-1.26)
  })

  it('turns the heading by 180°', () => {
    expect(alignHeading(robot1, 0.1)).toBeCloseTo(0.1 + Math.PI)
  })
})

describe('mirroring', () => {
  const truth: PositionAlignment = { rotation: 0.4, mirror: true, offset_x: 3, offset_y: -2 }
  const samples = [
    { x: 0, y: 0 },
    { x: 4, y: 1 },
    { x: 1, y: 5 },
    { x: -2, y: 3 },
  ].map((reported) => ({ reported, map: alignPosition(truth, reported) }))

  it('suggests mirroring when it fits clearly better (3+ samples)', () => {
    const best = fitBestRigid(samples)
    expect(best.suggestMirror).toBe(true)
    expect(best.mirrored!.rms_m).toBeLessThan(1e-9)
    expect(best.mirrored!.alignment.rotation).toBeCloseTo(0.4)
  })

  it('does not suggest it for an ordinary rotation', () => {
    expect(fitBestRigid(ROBOT2).suggestMirror).toBe(false)
  })

  it('mirrors the heading', () => {
    expect(alignHeading(truth, 0.3)).toBeCloseTo(-0.3 + 0.4)
  })
})
