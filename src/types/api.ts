// Shared between the browser app and Netlify Functions.

export type Role = 'admin' | 'user'

export interface SessionUser {
  id: string
  username: string
  role: Role
}

export interface AppUser extends SessionUser {
  created_at: string
  last_login_at: string | null
  locked_until: string | null
}

export interface Floor {
  id: string
  name: string
  level: number
  elevation_m: number
  plan_path: string | null
  /** Short-lived signed URL for the plan image, added by the API. */
  plan_url: string | null
  plan_width_px: number | null
  plan_height_px: number | null
  scale_m_per_px: number
  origin_x_px: number
  origin_y_px: number
  created_at: string
  updated_at: string
}

export interface PlanUploadTicket {
  path: string
  signedUrl: string
}

// ---------------------------------------------------------------------------
// Robot vendors
// ---------------------------------------------------------------------------

export type VendorStatus = 'not_configured' | 'disabled' | 'connected' | 'error'

export interface VendorSummary {
  id: string
  name: string
  description: string
  status: VendorStatus
  enabled: boolean
  robot_count: number
  last_sync_at: string | null
  last_callback_at: string | null
}

export interface SecretState {
  set: boolean
  last4: string | null
}

export interface VendorStore {
  external_id: string
  name: string | null
  brand: string | null
  address: string | null
  country: string | null
  synced_at: string
}

/** Vendor config as the browser sees it: secrets are masked. */
export interface VendorConfigView<S = Record<string, unknown>> {
  id: string
  name: string
  description: string
  status: VendorStatus
  enabled: boolean
  settings: S
  secrets: Record<string, SecretState>
  webhook_url: string
  token_expires_at: string | null
  last_sync_at: string | null
  last_sync_error: string | null
  last_callback_at: string | null
  stores: VendorStore[]
  robot_count: number
}

export interface VendorUpdate<S = Record<string, unknown>> {
  enabled?: boolean
  settings?: Partial<S>
  /** Only secrets present here are replaced. */
  secrets?: Record<string, string>
}

export interface VendorTestResult {
  token_expires_in: number | null
  stores: { external_id: string; name: string | null }[]
}

export interface VendorSyncResult {
  stores: number
  robots: number
}

export type SignatureStatus = 'valid' | 'invalid' | 'missing' | 'not_checked'
export type VendorEventStatus = 'processed' | 'ignored' | 'rejected' | 'failed'

export interface VendorEventSummary {
  id: string
  vendor: string
  received_at: string
  event_type: string
  robot_external_id: string | null
  signature: SignatureStatus
  status: VendorEventStatus
  error: string | null
}

export interface VendorEvent extends VendorEventSummary {
  signature_detail: string | null
  headers: Record<string, string> | null
  body: unknown
  body_text: string | null
  duration_ms: number | null
}

// ---------------------------------------------------------------------------
// Robots (normalized across vendors)
// ---------------------------------------------------------------------------

export type WorkState = 'idle' | 'busy' | 'charging' | 'operating' | 'scheduling' | 'starting' | 'offline' | 'unknown'

export interface RobotTask {
  source: string
  task_no: string | null
  state: string
  type: string | null
  error_code: number | null
  error_message: string | null
  detail: unknown
  updated_at: string
}

export interface Robot {
  id: string
  vendor: string
  external_id: string
  store_external_id: string | null
  store_name: string | null
  name: string | null
  model: string | null
  app_version: string | null
  online: boolean | null
  online_type: string | null
  battery: number | null
  charging: boolean | null
  work_state: WorkState
  can_be_called: boolean | null
  current_task: RobotTask | null
  vendor_status: Record<string, unknown> | null
  last_seen_at: string | null
  last_refreshed_at: string | null
  updated_at: string
}
