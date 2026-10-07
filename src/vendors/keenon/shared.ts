// Keenon constants shared by the browser config page and the Netlify Functions.

export const KEENON_REGIONS = {
  global: { label: 'Global', baseUrl: 'https://www.robotkeenon.com' },
  cn: { label: 'China', baseUrl: 'https://console.peanut.keenonrobot.com' },
  eu: { label: 'Europe', baseUrl: 'https://es.robotkeenon.com' },
  jp: { label: 'Japan', baseUrl: 'https://cloud.robotkeenon.com' },
} as const

export type KeenonRegion = keyof typeof KEENON_REGIONS | 'custom'

/** The only grant type Keenon's token endpoint accepts. */
export const KEENON_GRANT_TYPE = 'client_credentials'

export interface KeenonSettings {
  region: KeenonRegion
  custom_base_url: string
  client_id: string
  /** Reject callbacks without a valid X-Signature (Keenon support must enable signing first). */
  require_signature: boolean
  /** Stores whose robots are synced. Empty = all stores. */
  store_ids: string[]
}

export const KEENON_SECRET_FIELDS = ['client_secret'] as const

export function keenonBaseUrl(settings: Pick<KeenonSettings, 'region' | 'custom_base_url'>): string | null {
  if (settings.region === 'custom') return settings.custom_base_url.trim().replace(/\/+$/, '') || null
  return KEENON_REGIONS[settings.region]?.baseUrl ?? null
}
