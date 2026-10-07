import { describe, expect, it } from 'vitest'
import { refreshWaitSeconds } from './robotRefresh'

const NOW = Date.parse('2026-10-07T12:00:00Z')
const COOLDOWN = 10_000
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('refreshWaitSeconds', () => {
  it('is 0 for a robot never refreshed', () => {
    expect(refreshWaitSeconds(null, COOLDOWN, NOW)).toBe(0)
  })

  it('is the full cooldown right after a refresh', () => {
    expect(refreshWaitSeconds(ago(0), COOLDOWN, NOW)).toBe(10)
  })

  it('rounds partial seconds up', () => {
    expect(refreshWaitSeconds(ago(3_200), COOLDOWN, NOW)).toBe(7)
    expect(refreshWaitSeconds(ago(9_999), COOLDOWN, NOW)).toBe(1)
  })

  it('is 0 once the cooldown has passed', () => {
    expect(refreshWaitSeconds(ago(COOLDOWN), COOLDOWN, NOW)).toBe(0)
    expect(refreshWaitSeconds(ago(60_000), COOLDOWN, NOW)).toBe(0)
  })

  it('uses the given cooldown', () => {
    expect(refreshWaitSeconds(ago(1_000), 30_000, NOW)).toBe(29)
    expect(refreshWaitSeconds(ago(0), 0, NOW)).toBe(0)
  })
})
