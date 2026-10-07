import type { Config } from '@netlify/functions'
import { db } from '../lib/supabaseAdmin'
import { VENDORS } from '../vendors/index'
import { EVENT_RETENTION_DAYS, contextFor, loadConfig, persistSync, updateConfig } from '../vendors/store'

/**
 * Hourly housekeeping:
 *  - delete vendor events older than the retention period;
 *  - re-sync stores/robots for vendors whose `<VENDOR>_SCHEDULED_SYNC=true`.
 *    Off by default: e.g. Keenon only accepts whitelisted IPs, and Netlify's are not fixed.
 */
export default async () => {
  const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 86_400_000).toISOString()
  const { error } = await db().from('vendor_events').delete().lt('received_at', cutoff)
  if (error) console.error('Event cleanup failed', error)

  for (const adapter of VENDORS) {
    if (process.env[`${adapter.id.toUpperCase()}_SCHEDULED_SYNC`] !== 'true') continue
    const config = await loadConfig(adapter.id)
    if (!config?.enabled || !adapter.isConfigured(config)) continue
    try {
      await persistSync(adapter.id, await adapter.fetchSyncData(contextFor(config)))
      await updateConfig(adapter.id, { last_sync_at: new Date().toISOString(), last_sync_error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${adapter.id} scheduled sync failed: ${message}`)
      await updateConfig(adapter.id, { last_sync_error: message })
    }
  }
}

export const config: Config = {
  schedule: '@hourly',
}
