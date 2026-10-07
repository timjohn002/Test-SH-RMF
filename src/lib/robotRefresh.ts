// On-demand robot status refreshes call the vendor's cloud live, so each robot is
// limited to one refresh per cooldown. The cooldown is vendor-specific (each adapter's
// `robotCapabilities.refreshCooldownMs`); this helper is shared by the Robots page
// (countdown) and the robots function (enforcement).

/** Whole seconds until the robot may be refreshed again; 0 = now. */
export function refreshWaitSeconds(lastRefreshedAt: string | null, cooldownMs: number, now = Date.now()): number {
  if (!lastRefreshedAt) return 0
  const remaining = cooldownMs - (now - Date.parse(lastRefreshedAt))
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}
