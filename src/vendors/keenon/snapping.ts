import type { Point } from '../../lib/coords'

export type SnapMode = 'off' | 'close' | 'normal'

/** Snap radius on screen (constant at every zoom level). */
export const SNAP_RADIUS_SCREEN_PX: Record<SnapMode, number> = { off: 0, close: 6, normal: 12 }

export const SNAP_MODE_LABEL: Record<SnapMode, string> = {
  off: 'Off',
  close: 'Close (6 px)',
  normal: 'Normal (12 px)',
}

export interface SnapCandidate {
  /** Where the point is on the displayed Keenon image (image pixels). */
  image: Point
  name: string
}

/**
 * The named point to snap a click to, or null to use the exact click.
 * `screenPxPerImagePx` converts the on-screen radius into image pixels at the current zoom.
 */
export function snapToNamedPoint<T extends SnapCandidate>(
  click: Point,
  candidates: T[],
  opts: { mode: SnapMode; screenPxPerImagePx: number; altKey?: boolean },
): T | null {
  if (opts.mode === 'off' || opts.altKey || !(opts.screenPxPerImagePx > 0)) return null
  const radius = SNAP_RADIUS_SCREEN_PX[opts.mode] / opts.screenPxPerImagePx
  let best: T | null = null
  let bestDist = radius
  for (const c of candidates) {
    const d = Math.hypot(c.image.x - click.x, c.image.y - click.y)
    if (d <= bestDist) {
      best = c
      bestDist = d
    }
  }
  return best
}
