import type { Config } from '@netlify/functions'
import { z } from 'zod'
import type { Robot } from '../../src/types/api'
import { HttpError, handler, json, methodNotAllowed, requireUser } from '../lib/http'
import { db } from '../lib/supabaseAdmin'
import { VendorApiError } from '../vendors/errors'
import { findAdapter } from '../vendors/index'
import { applyRobotPatch, contextFor, loadConfig } from '../vendors/store'

/** Minimum gap between on-demand status pulls for one robot (vendor rate limits). */
const REFRESH_COOLDOWN_MS = 30_000

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
  const { data, error } = await db().from('robots').select('*').order('vendor').order('name', { nullsFirst: false })
  if (error) throw error
  const names = await storeNames()
  return json((data as RobotRow[]).map((r) => withStore(r, names)))
}

async function refreshRobot(id: string): Promise<Response> {
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'Robot not found')
  const { data: robot, error } = await db().from('robots').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!robot) throw new HttpError(404, 'Robot not found')
  const row = robot as RobotRow

  if (row.last_refreshed_at) {
    const wait = REFRESH_COOLDOWN_MS - (Date.now() - Date.parse(row.last_refreshed_at))
    if (wait > 0) throw new HttpError(429, `Refreshed recently. Try again in ${Math.ceil(wait / 1000)} s.`)
  }

  const adapter = findAdapter(row.vendor)
  const config = adapter ? await loadConfig(adapter.id) : null
  if (!adapter || !config || !adapter.isConfigured(config)) {
    throw new HttpError(400, `The ${row.vendor} integration is not configured.`)
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
