import { z } from 'zod'
import { KEENON_SECRET_FIELDS, keenonBaseUrl, type KeenonSettings } from '../../../src/vendors/keenon/shared'
import type { RobotPatch, SyncedRobot, VendorAdapter, VendorConfigRow, VendorContext } from '../types'
import { getBatteryLevel, getCleanStatus, getRobotStatus, getRobots, getStores } from './api'
import { KeenonClient, KeenonError } from './client'
import { KEENON_ONLINE_TYPE, KEENON_OK } from './types'
import { interpretKeenonCallback, verifyKeenonSignature } from './webhook'

const settingsSchema = z.object({
  region: z.enum(['global', 'cn', 'eu', 'jp', 'custom']).default('global'),
  custom_base_url: z
    .string()
    .trim()
    .max(300)
    .default('')
    .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Custom URL must start with http:// or https://'),
  client_id: z.string().trim().max(200).default(''),
  require_signature: z.boolean().default(false),
  store_ids: z.array(z.string().max(100)).max(500).default([]),
})

function settingsOf(config: VendorConfigRow): KeenonSettings {
  return settingsSchema.parse(config.settings)
}

function clientFor(ctx: VendorContext): KeenonClient {
  const settings = settingsOf(ctx.config)
  const baseUrl = keenonBaseUrl(settings)
  const clientSecret = ctx.config.secrets.client_secret
  if (!baseUrl || !settings.client_id || !clientSecret) {
    throw new KeenonError(null, 'Keenon is not fully configured: set the region, client ID and client secret.')
  }
  const { access_token, token_expires_at } = ctx.config
  return new KeenonClient({
    baseUrl,
    clientId: settings.client_id,
    clientSecret,
    cachedToken:
      access_token && token_expires_at ? { token: access_token, expiresAt: new Date(token_expires_at) } : null,
    saveToken: ctx.saveToken,
  })
}

export const keenonAdapter: VendorAdapter = {
  id: 'keenon',
  name: 'Keenon',
  description: 'Delivery, hotel and cleaning robots via Keenon Cloud (Open Platform API).',
  settingsSchema,
  secretFields: KEENON_SECRET_FIELDS,
  credentialSettings: ['region', 'custom_base_url', 'client_id'],
  // Keenon disables IPs/clients that query too often (610609 / 617000).
  robotCapabilities: { refresh: true, refreshCooldownMs: 10_000 },

  isConfigured(config) {
    const settings = settingsSchema.safeParse(config.settings)
    return settings.success && !!keenonBaseUrl(settings.data) && !!settings.data.client_id && !!config.secrets.client_secret
  },

  async testConnection(ctx) {
    const client = clientFor(ctx)
    await client.getToken(true)
    const stores = await getStores(client)
    return {
      token_expires_in: client.tokenExpiresIn,
      stores: stores.map((s) => ({ external_id: s.storeId, name: s.storeName ?? null })),
    }
  },

  async fetchSyncData(ctx) {
    const client = clientFor(ctx)
    const { store_ids } = settingsOf(ctx.config)
    const stores = await getStores(client)
    const selected = store_ids.length ? stores.filter((s) => store_ids.includes(s.storeId)) : stores

    const robots: SyncedRobot[] = []
    // Sequential on purpose: Keenon rate-limits by client and IP.
    for (const store of selected) {
      for (const r of await getRobots(client, store.storeId)) {
        if (!r.robotId) continue
        const online = r.onlineStatus === undefined ? null : r.onlineStatus === 1
        robots.push({
          external_id: r.robotId,
          store_external_id: store.storeId,
          name: r.robotName ?? null,
          model: r.robotModel ?? null,
          app_version: r.appVersion ?? null,
          online,
          online_type: r.onlineType !== undefined ? (KEENON_ONLINE_TYPE[r.onlineType] ?? String(r.onlineType)) : null,
          battery: typeof r.power === 'number' ? r.power : null,
          ...(online === false ? { work_state: 'offline' as const } : {}),
        })
      }
    }

    return {
      stores: stores.map((s) => ({
        external_id: s.storeId,
        name: s.storeName ?? null,
        brand: s.brandName ?? null,
        address: s.address ?? null,
        country: s.country ?? null,
      })),
      robots,
    }
  },

  async fetchRobotStatus(ctx, robotId) {
    const client = clientFor(ctx)
    try {
      const status = await getRobotStatus(client, robotId)
      if (!status) return {}
      const patch: RobotPatch = {
        online: status.onlineStatus ?? null,
        can_be_called: status.canBeCalled ?? null,
        charging: status.chargeStatus === undefined ? null : status.chargeStatus === 1,
        battery: typeof status.power === 'number' ? status.power : null,
      }
      if (status.robotName) patch.name = status.robotName
      if (status.onlineStatus === false) patch.work_state = 'offline'
      return patch
    } catch (err) {
      // The scene status API is for delivery/hotel robots; cleaning robots use their own.
      if (!(err instanceof KeenonError) || err.code === null || err.code === KEENON_OK) throw err
      const clean = await getCleanStatus(client, robotId)
      if (!clean) throw err
      const { patch } = interpretKeenonCallback({ bizType: 'CleanRobotStatus', data: { ...clean, robotSn: robotId } })
      const battery = await getBatteryLevel(client, robotId).catch(() => null)
      return { ...patch, ...(battery !== null ? { battery } : {}) }
    }
  },

  verifyWebhook(config, rawBody, headers) {
    return verifyKeenonSignature(rawBody, headers, config.secrets.client_secret)
  },

  requireSignature(config) {
    const settings = settingsSchema.safeParse(config.settings)
    return settings.success && settings.data.require_signature
  },

  interpretWebhook: (body) => interpretKeenonCallback(body),

  webhookAck: { code: KEENON_OK, msg: 'success' },
}
