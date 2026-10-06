// Coordinate helpers for floor plans.
//
// Three spaces are involved:
//  - pixel:  image pixels, (0,0) at the top-left corner, y pointing down.
//  - world:  meters, (0,0) at the floor's origin, y pointing UP (ROS / Open-RMF convention).
//  - latlng: Leaflet CRS.Simple map units. We use lat = -pixelY, lng = pixelX, so one
//            map unit is one image pixel at zoom 0.

export interface Point {
  x: number
  y: number
}

export interface PlanCalibration {
  scale_m_per_px: number
  origin_x_px: number
  origin_y_px: number
}

export type LatLngTuple = [number, number]

export function pixelToLatLng(p: Point): LatLngTuple {
  return [-p.y, p.x]
}

export function latLngToPixel(lat: number, lng: number): Point {
  return { x: lng, y: -lat }
}

/** Leaflet bounds covering a whole plan image. */
export function planBounds(widthPx: number, heightPx: number): [LatLngTuple, LatLngTuple] {
  return [
    [-heightPx, 0],
    [0, widthPx],
  ]
}

export function worldToPixel(w: Point, cal: PlanCalibration): Point {
  return {
    x: cal.origin_x_px + w.x / cal.scale_m_per_px,
    y: cal.origin_y_px - w.y / cal.scale_m_per_px,
  }
}

export function pixelToWorld(p: Point, cal: PlanCalibration): Point {
  return {
    x: (p.x - cal.origin_x_px) * cal.scale_m_per_px,
    y: (cal.origin_y_px - p.y) * cal.scale_m_per_px,
  }
}

/** Meters per pixel, given two pixel points that are `meters` apart in reality. */
export function scaleFromTwoPoints(a: Point, b: Point, meters: number): number {
  const px = Math.hypot(b.x - a.x, b.y - a.y)
  if (px === 0) throw new Error('The two points must be different')
  if (!(meters > 0)) throw new Error('Distance must be greater than 0')
  return meters / px
}

/** A round length (1, 2 or 5 × 10^n meters) that is roughly `targetPx` pixels long. */
export function niceLength(scaleMPerPx: number, targetPx = 100): number {
  const raw = targetPx * scaleMPerPx
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = raw / magnitude
  const nice = step >= 5 ? 5 : step >= 2 ? 2 : 1
  return nice * magnitude
}

export function formatMeters(m: number): string {
  if (m === 0) return '0 m'
  if (Math.abs(m) >= 1) return `${Number(m.toFixed(2))} m`
  if (Math.abs(m) >= 0.01) return `${Number((m * 100).toFixed(1))} cm`
  return `${Number((m * 1000).toFixed(1))} mm`
}
