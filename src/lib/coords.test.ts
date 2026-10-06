import { describe, expect, it } from 'vitest'
import {
  formatMeters,
  latLngToPixel,
  niceLength,
  pixelToLatLng,
  pixelToWorld,
  scaleFromTwoPoints,
  worldToPixel,
} from './coords'

const cal = { scale_m_per_px: 0.05, origin_x_px: 100, origin_y_px: 400 }

describe('world <-> pixel', () => {
  it('maps the origin to the origin pixel', () => {
    expect(worldToPixel({ x: 0, y: 0 }, cal)).toEqual({ x: 100, y: 400 })
  })

  it('treats world +y as up (pixel y decreases)', () => {
    expect(worldToPixel({ x: 1, y: 2 }, cal)).toEqual({ x: 120, y: 360 })
  })

  it('round-trips', () => {
    const w = { x: -3.25, y: 7.5 }
    const back = pixelToWorld(worldToPixel(w, cal), cal)
    expect(back.x).toBeCloseTo(w.x)
    expect(back.y).toBeCloseTo(w.y)
  })
})

describe('pixel <-> latlng', () => {
  it('round-trips', () => {
    const [lat, lng] = pixelToLatLng({ x: 30, y: 40 })
    expect([lat, lng]).toEqual([-40, 30])
    expect(latLngToPixel(lat, lng)).toEqual({ x: 30, y: 40 })
  })
})

describe('scaleFromTwoPoints', () => {
  it('computes meters per pixel', () => {
    expect(scaleFromTwoPoints({ x: 0, y: 0 }, { x: 300, y: 400 }, 10)).toBeCloseTo(0.02)
  })

  it('rejects identical points and non-positive distances', () => {
    expect(() => scaleFromTwoPoints({ x: 1, y: 1 }, { x: 1, y: 1 }, 5)).toThrow()
    expect(() => scaleFromTwoPoints({ x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toThrow()
  })
})

describe('niceLength', () => {
  it('rounds to 1/2/5 steps', () => {
    expect(niceLength(0.05)).toBe(5) // 100px * 0.05 = 5 m
    expect(niceLength(0.031)).toBe(2) // 3.1 m -> 2
    expect(niceLength(0.0012)).toBeCloseTo(0.1) // 0.12 m -> 0.1
  })
})

describe('formatMeters', () => {
  it('picks a sensible unit', () => {
    expect(formatMeters(12.345)).toBe('12.35 m')
    expect(formatMeters(0.25)).toBe('25 cm')
    expect(formatMeters(0.004)).toBe('4 mm')
  })
})
