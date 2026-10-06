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
