import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { refreshWaitSeconds } from '../../src/lib/robotRefresh'
import type { Robot, RobotVendorInfo, RobotsResponse } from '../../src/types/api'
import { HttpError, handler, json, methodNotAllowed, requireUser } from '../lib/http'
import { db } from '../lib/supabaseAdmin'
import { VendorApiError } from '../vendors/errors'
import { findAdapter } from '../vendors/index'
import { groupRobots, unknownVendorInfo } from '../vendors/robotGroups'
import { applyRobotPatch, contextFor, loadConfig, vendorStatus } from '../vendors/store'
import type { VendorConfigRow } from '../vendors/types'

type RobotRow = Omit<Robot, 'store_name'>

async function storeNames(): Promise<Map<string, string | null>> {
  const { data, error } = await db().from('vendor_stores').select('vendor, external_id, name')
  if (error) throw error
  return new Map(
    (data as { vendor: string; external_id: string; name: string | null }[]).map((s) => [
      `${s.vendor}:${s.external_id}`,
      s.name,
    ]),
  )
}

function withStore(row: RobotRow, names: Map<string, string | null>): Robot {
  return { ...row, store_name: row.store_external_id ? (names.get(`${row.vendor}:${row.store_external_id}`) ?? null) : null }
}

async function listRobots(): Promise<Response> {
  const { data, error } = await db().from('robots').select('*')
  if (error) throw error
  const { data: configRows, error: configError } = await db().from('vendor_configs').select('*')
  if (configError) throw configError
  const configs = new Map((configRows as VendorConfigRow[]).map((c) => [c.vendor, c]))
  const names = await storeNames()

  // Vendor names, status and capabilities come from each vendor's adapter.
  const vendorInfo = (vendorId: string): RobotVendorInfo => {
    const adapter = findAdapter(vendorId)
    if (!adapter) return unknownVendorInfo(vendorId)
    return {
      id: adapter.id,
      name: adapter.name,
      status: vendorStatus(adapter, configs.get(adapter.id) ?? null),
      capabilities: {
        refresh: adapter.robotCapabilities.refresh,
        refresh_cooldown_ms: adapter.robotCapabilities.refreshCooldownMs,
      },
    }
  }

  const body: RobotsResponse = {
    groups: groupRobots(
      (data as RobotRow[]).map((r) => withStore(r, names)),
      vendorInfo,
    ),
  }
  return json(body)
}

async function refreshRobot(id: string): Promise<Response> {
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'Robot not found')
  const { data: robot, error } = await db().from('robots').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!robot) throw new HttpError(404, 'Robot not found')
  const row = robot as RobotRow

  const adapter = findAdapter(row.vendor)
  if (!adapter?.robotCapabilities.refresh) throw new HttpError(400, "Refresh isn't supported for this vendor.")

  // The page shows a countdown; this guards against other sessions and direct calls.
  const wait = refreshWaitSeconds(row.last_refreshed_at, adapter.robotCapabilities.refreshCooldownMs)
  if (wait > 0) throw new HttpError(429, `Refreshed recently. Try again in ${wait} s.`)

  const config = await loadConfig(adapter.id)
  if (!config || !adapter.isConfigured(config)) {
    throw new HttpError(400, `The ${adapter.name} integration is not configured.`)
  }

  let patch
  try {
    patch = await adapter.fetchRobotStatus(contextFor(config), row.external_id)
  } catch (err) {
    if (err instanceof VendorApiError) throw new HttpError(502, err.message)
    throw err
  }
  await applyRobotPatch(row.vendor, row.external_id, patch, { last_refreshed_at: new Date().toISOString() })

  const { data: updated, error: readError } = await db().from('robots').select('*').eq('id', id).single()
  if (readError) throw readError
  return json(withStore(updated as RobotRow, await storeNames()))
}

export default handler(async (req, params) => {
  await requireUser(req)
  if (!params.id) {
    if (req.method !== 'GET') methodNotAllowed()
    return listRobots()
  }
  if (req.method !== 'POST') methodNotAllowed()
  return refreshRobot(params.id)
})

export const config: Config = {
  path: ['/api/robots', '/api/robots/:id/refresh'],
}
