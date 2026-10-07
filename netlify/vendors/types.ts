import type { z } from 'zod'
import type { RobotTask, SignatureStatus, VendorStore, VendorTestResult, WorkState } from '../../src/types/api'

/** A `vendor_configs` row. `secrets` must never leave the server. */
export interface VendorConfigRow {
  vendor: string
  enabled: boolean
  settings: Record<string, unknown>
  secrets: Record<string, string>
  webhook_token: string
  access_token: string | null
  token_expires_at: string | null
  last_sync_at: string | null
  last_sync_error: string | null
  last_callback_at: string | null
  updated_at: string
}

/** Fields a vendor may set on a `robots` row. Omitted fields are left unchanged. */
export interface RobotPatch {
  store_external_id?: string | null
  name?: string | null
  model?: string | null
  app_version?: string | null
  online?: boolean | null
  online_type?: string | null
  battery?: number | null
  charging?: boolean | null
  work_state?: WorkState
  can_be_called?: boolean | null
  current_task?: RobotTask | null
  vendor_status?: Record<string, unknown> | null
}

export interface SyncedRobot extends RobotPatch {
  external_id: string
}

export type SyncedStore = Omit<VendorStore, 'synced_at'>

export interface SyncData {
  stores: SyncedStore[]
  robots: SyncedRobot[]
}

export interface SignatureCheck {
  status: SignatureStatus
  detail?: string
}

/** What a vendor callback means, independent of how it is stored. */
export interface WebhookInterpretation {
  eventType: string
  robotExternalId: string | null
  patch: RobotPatch | null
  status: 'processed' | 'ignored'
  note?: string
}

/** Everything an adapter needs to call the vendor's API. */
export interface VendorContext {
  config: VendorConfigRow
  /** Persist a fresh API token so other function invocations can reuse it. */
  saveToken(token: string, expiresAt: Date): Promise<void>
}

export interface VendorAdapter {
  id: string
  name: string
  description: string
  /** Parses stored settings, filling defaults. */
  settingsSchema: z.ZodType<Record<string, unknown>>
  secretFields: readonly string[]
  /** Enough settings + secrets to call the vendor API. */
  isConfigured(config: VendorConfigRow): boolean
  /** Settings keys whose change invalidates the cached API token. */
  credentialSettings: readonly string[]
  /** What the Robots page may do with this vendor's robots. */
  robotCapabilities: {
    /** On-demand live status pull (`fetchRobotStatus`). */
    refresh: boolean
    /** Minimum gap between refreshes of one robot (vendor rate limits). */
    refreshCooldownMs: number
  }

  testConnection(ctx: VendorContext): Promise<VendorTestResult>
  fetchSyncData(ctx: VendorContext): Promise<SyncData>
  fetchRobotStatus(ctx: VendorContext, externalId: string): Promise<RobotPatch>

  verifyWebhook(config: VendorConfigRow, rawBody: string, headers: Headers): SignatureCheck
  requireSignature(config: VendorConfigRow): boolean
  interpretWebhook(body: unknown): WebhookInterpretation
  /** Body to reply to the vendor with after a callback is accepted. */
  webhookAck: unknown
}
