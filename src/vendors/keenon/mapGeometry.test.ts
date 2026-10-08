import { describe, expect, it } from 'vitest'
import { pixelToWorld, worldToPixel } from '../../lib/coords'
import { keenonMapCalibration, mapPixelToImage, mapPixelToMeters, metersToMapPixel } from './mapGeometry'

// Real data, scene 489rAM floor 2 (2026-10-07).
const FLOOR2 = { map_width: 480, map_height: 476, origin_x_m: -12.75, origin_y_m: -12.550000190734863 }
const CHARGING_PILE = { x: 243.08897293414097, y: 225.18616590909548 } // map pixels
const DOCKED_C40 = { x: -1.47, y: -1.26 } // metres, reported while charging

describe('Keenon map geometry', () => {
  it('puts the docked C40 within 1 m of its charging pile', () => {
    const pile = mapPixelToMeters(FLOOR2, CHARGING_PILE)
    expect(Math.hypot(pile.x - DOCKED_C40.x, pile.y - DOCKED_C40.y)).toBeLessThan(1)
  })

  it('round-trips metres and map pixels', () => {
    const back = mapPixelToMeters(FLOOR2, metersToMapPixel(FLOOR2, DOCKED_C40))
    expect(back.x).toBeCloseTo(DOCKED_C40.x)
    expect(back.y).toBeCloseTo(DOCKED_C40.y)
  })

  it('flips y for the image (origin is bottom-left)', () => {
    expect(mapPixelToImage(FLOOR2, { x: 10, y: 0 })).toEqual({ x: 10, y: 476 })
    expect(mapPixelToImage(FLOOR2, { x: 10, y: 476 })).toEqual({ x: 10, y: 0 })
  })

  it("gives PlanMap a calibration whose world frame is the robot's frame", () => {
    const cal = keenonMapCalibration(FLOOR2)
    // A named point: map pixels → metres → image pixels must equal the y-flipped point.
    const metres = mapPixelToMeters(FLOOR2, CHARGING_PILE)
    const image = worldToPixel(metres, cal)
    const expected = mapPixelToImage(FLOOR2, CHARGING_PILE)
    expect(image.x).toBeCloseTo(expected.x)
    expect(image.y).toBeCloseTo(expected.y)
    // And the cursor readout (image pixel → world) gives robot metres back.
    const readout = pixelToWorld(image, cal)
    expect(readout.x).toBeCloseTo(metres.x)
    expect(readout.y).toBeCloseTo(metres.y)
  })
})
