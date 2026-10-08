import type { RobotPosition } from '../../types/api'

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

// ---------------------------------------------------------------------------
// Robot maps (scenes → floors → Keenon map images)
// ---------------------------------------------------------------------------

/**
 * Metres per map pixel. Keenon doesn't document it; 0.05 m/px (the usual robot-map
 * resolution) matched a docked robot's reported position against its charging-pile point.
 */
export const KEENON_MAP_RESOLUTION = 0.05

/** A named point on a Keenon map, in map pixels measured from the map origin (y up). */
export interface KeenonMapPoint {
  id: number | null
  name: string
  type: string | null
  x_px: number
  y_px: number
  map_md5: string | null
  floor_label: string | null
  building: string | null
}

/** One Keenon floor (map) of a robot's scene, and the app floor it's matched to. */
export interface KeenonRobotFloor {
  id: string
  robot_id: string
  scene_code: string
  floor: number
  floor_label: string | null
  building: string | null
  map_png: string | null
  map_width: number | null
  map_height: number | null
  origin_x_m: number | null
  origin_y_m: number | null
  is_dynamic: boolean | null
  points: KeenonMapPoint[]
  map_versions: string[]
  sources: string[]
  last_seen_at: string
  app_floor_id: string | null
  matched_at: string | null
}

export interface KeenonSceneInfo {
  code: string | null
  name: string | null
  /** 'manual' = picked by an admin; 'detected' = reported by the robot. */
  source: 'manual' | 'detected' | null
}

export interface KeenonRobotMapSummary {
  robot_id: string
  external_id: string
  name: string | null
  model: string | null
  store_external_id: string | null
  store_name: string | null
  scene: KeenonSceneInfo
  detected_scene: { code: string | null; name: string | null }
  floors_found: number
  floors_matched: number
  discovered_at: string | null
  discovery_error: string | null
}

export interface KeenonRobotMapsDetail {
  robot: KeenonRobotMapSummary
  position: RobotPosition | null
  /** Floors of the robot's current scene first; other scenes after. */
  floors: KeenonRobotFloor[]
}

export interface KeenonScene {
  code: string
  name: string
}
