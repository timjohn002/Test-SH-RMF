import { describe, expect, it } from 'vitest'
import { ROBOT_REFRESH_COOLDOWN_MS, refreshWaitSeconds } from './robotRefresh'

const NOW = Date.parse('2026-10-07T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('refreshWaitSeconds', () => {
  it('is 0 for a robot never refreshed', () => {
    expect(refreshWaitSeconds(null, NOW)).toBe(0)
  })

  it('is the full cooldown right after a refresh', () => {
    expect(refreshWaitSeconds(ago(0), NOW)).toBe(ROBOT_REFRESH_COOLDOWN_MS / 1000)
  })

  it('rounds partial seconds up', () => {
    expect(refreshWaitSeconds(ago(3_200), NOW)).toBe(7)
    expect(refreshWaitSeconds(ago(9_999), NOW)).toBe(1)
  })

  it('is 0 once the cooldown has passed', () => {
    expect(refreshWaitSeconds(ago(ROBOT_REFRESH_COOLDOWN_MS), NOW)).toBe(0)
    expect(refreshWaitSeconds(ago(60_000), NOW)).toBe(0)
  })
})
