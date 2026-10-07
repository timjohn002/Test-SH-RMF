// On-demand robot status refreshes call the vendor's cloud live, so each robot
// is limited to one refresh per cooldown (vendor rate limits, e.g. Keenon 610609/617000).
// Shared by the Robots page (countdown) and the robots function (enforcement).

export const ROBOT_REFRESH_COOLDOWN_MS = 10_000

/** Whole seconds until the robot may be refreshed again; 0 = now. */
export function refreshWaitSeconds(lastRefreshedAt: string | null, now = Date.now()): number {
  if (!lastRefreshedAt) return 0
  const remaining = ROBOT_REFRESH_COOLDOWN_MS - (now - Date.parse(lastRefreshedAt))
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}
