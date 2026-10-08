import { describe, expect, it } from 'vitest'
import { snapToNamedPoint } from './snapping'

const POINTS = [
  { image: { x: 100, y: 100 }, name: 'Office' },
  { image: { x: 104, y: 100 }, name: 'Room1' },
]

describe('snapToNamedPoint', () => {
  it('never snaps when off or when Alt is held', () => {
    expect(snapToNamedPoint({ x: 100, y: 100 }, POINTS, { mode: 'off', screenPxPerImagePx: 1 })).toBeNull()
    expect(snapToNamedPoint({ x: 100, y: 100 }, POINTS, { mode: 'normal', screenPxPerImagePx: 1, altKey: true })).toBeNull()
  })

  it('picks the nearest point within the radius', () => {
    expect(snapToNamedPoint({ x: 103, y: 101 }, POINTS, { mode: 'close', screenPxPerImagePx: 1 })?.name).toBe('Room1')
  })

  it('keeps the same on-screen radius at every zoom', () => {
    // 5 screen px away: inside "close" (6 px) at any zoom...
    for (const scale of [0.5, 1, 4]) {
      const click = { x: 100 - 5 / scale, y: 100 }
      expect(snapToNamedPoint(click, POINTS, { mode: 'close', screenPxPerImagePx: scale })?.name).toBe('Office')
    }
    // ...and 8 screen px away is outside "close" but inside "normal" (12 px), at any zoom.
    for (const scale of [0.5, 1, 4]) {
      const click = { x: 100 - 8 / scale, y: 100 }
      expect(snapToNamedPoint(click, POINTS, { mode: 'close', screenPxPerImagePx: scale })).toBeNull()
      expect(snapToNamedPoint(click, POINTS, { mode: 'normal', screenPxPerImagePx: scale })?.name).toBe('Office')
    }
  })
})
