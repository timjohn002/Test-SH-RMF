import type { Config } from '@netlify/functions'
import { z } from 'zod'
import type { RobotPosition } from '../../src/types/api'
import type {
  KeenonRobotFloor,
  KeenonRobotMapSummary,
  KeenonRobotMapsDetail,
  KeenonScene,
} from '../../src/vendors/keenon/shared'
import { HttpError, handler, json, methodNotAllowed, parseBody, requireAdmin } from '../lib/http'
import { db } from '../lib/supabaseAdmin'
import { VendorApiError } from '../vendors/errors'
import { keenonAdapter, keenonClientFor } from '../vendors/keenon/adapter'
import { getScenes } from '../vendors/keenon/api'
import { discoverRobotMaps } from '../vendors/keenon/mapDiscovery'
import { contextFor, loadConfig } from '../vendors/store'

// Keenon-only: which floors (maps) each Keenon robot knows, and which app floor each matches.

interface RobotRow {
  id: string
  external_id: string
  name: string | null
  model: string | null
  store_external_id: string | null
  position: RobotPosition | null
}

interface SceneRow {
  robot_id: string
  detected_scene_code: string | null
  detected_scene_name: string | null
  manual_scene_code: string | null
  manual_scene_name: string | null
  discovered_at: string | null
  discovery_error: string | null
}

const ROBOT_COLUMNS = 'id, external_id, name, model, store_external_id, position'
const FLOOR_SUMMARY_COLUMNS = 'robot_id, scene_code, app_floor_id'

async function keenonClient() {
  const config = await loadConfig(keenonAdapter.id)
  if (!config || !keenonAdapter.isConfigured(config)) {
    throw new HttpError(400, 'Keenon is not configured. Set it up in Vendors → Keenon first.')
  }
  return keenonClientFor(contextFor(config))
}

/** Vendor API failures → 502 with Keenon's plain-language message. */
async function callKeenon<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof VendorApiError) throw new HttpError(502, err.message)
    throw err
  }
}

function currentScene(scene: SceneRow | undefined): KeenonRobotMapSummary['scene'] {
  if (scene?.manual_scene_code) return { code: scene.manual_scene_code, name: scene.manual_scene_name, source: 'manual' }
  if (scene?.detected_scene_code) {
    return { code: scene.detected_scene_code, name: scene.detected_scene_name, source: 'detected' }
  }
  return { code: null, name: null, source: null }
}

async function storeNames(): Promise<Map<string, string | null>> {
  const { data, error } = await db().from('vendor_stores').select('external_id, name').eq('vendor', 'keenon')
  if (error) throw error
  return new Map((data as { external_id: string; name: string | null }[]).map((s) => [s.external_id, s.name]))
}

function summarize(
  robot: RobotRow,
  scene: SceneRow | undefined,
  floors: { scene_code: string; app_floor_id: string | null }[],
  stores: Map<string, string | null>,
): KeenonRobotMapSummary {
  const current = currentScene(scene)
  const inScene = floors.filter((f) => f.scene_code === current.code)
  return {
    robot_id: robot.id,
    external_id: robot.external_id,
    name: robot.name,
    model: robot.model,
    store_external_id: robot.store_external_id,
    store_name: robot.store_external_id ? (stores.get(robot.store_external_id) ?? null) : null,
    scene: current,
    detected_scene: { code: scene?.detected_scene_code ?? null, name: scene?.detected_scene_name ?? null },
    floors_found: inScene.length,
    floors_matched: inScene.filter((f) => f.app_floor_id).length,
    discovered_at: scene?.discovered_at ?? null,
    discovery_error: scene?.discovery_error ?? null,
  }
}

async function loadRobot(id: string): Promise<RobotRow> {
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'Robot not found')
  const { data, error } = await db().from('robots').select(ROBOT_COLUMNS).eq('id', id).eq('vendor', 'keenon').maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Robot not found')
  return data as RobotRow
}

async function loadScene(robotId: string): Promise<SceneRow | undefined> {
  const { data, error } = await db().from('keenon_robot_scenes').select('*').eq('robot_id', robotId).maybeSingle()
  if (error) throw error
  return (data as SceneRow | null) ?? undefined
}

async function listRobots(): Promise<Response> {
  const [robots, scenes, floors, stores] = await Promise.all([
    db().from('robots').select(ROBOT_COLUMNS).eq('vendor', 'keenon').order('name'),
    db().from('keenon_robot_scenes').select('*'),
    db().from('keenon_robot_floors').select(FLOOR_SUMMARY_COLUMNS),
    storeNames(),
  ])
  for (const r of [robots, scenes, floors]) if (r.error) throw r.error
  const sceneBy = new Map((scenes.data as SceneRow[]).map((s) => [s.robot_id, s]))
  const floorRows = floors.data as { robot_id: string; scene_code: string; app_floor_id: string | null }[]
  return json(
    (robots.data as RobotRow[]).map((r) =>
      summarize(r, sceneBy.get(r.id), floorRows.filter((f) => f.robot_id === r.id), stores),
    ),
  )
}

async function robotDetail(robotId: string): Promise<KeenonRobotMapsDetail> {
  const robot = await loadRobot(robotId)
  const scene = await loadScene(robot.id)
  const { data, error } = await db()
    .from('keenon_robot_floors')
    .select('*')
    .eq('robot_id', robot.id)
    .order('scene_code')
    .order('floor')
  if (error) throw error
  const floors = data as KeenonRobotFloor[]
  const sceneCode = currentScene(scene).code
  // Current scene's floors first; floors of previously used scenes after.
  floors.sort((a, b) => Number(b.scene_code === sceneCode) - Number(a.scene_code === sceneCode))
  return {
    robot: summarize(robot, scene, floors, await storeNames()),
    position: robot.position,
    floors,
  }
}

async function discover(robotId: string): Promise<Response> {
  const robot = await loadRobot(robotId)
  const scene = await loadScene(robot.id)
  const manual = scene?.manual_scene_code ? { code: scene.manual_scene_code, name: scene.manual_scene_name } : null
  const client = await keenonClient()

  let result
  try {
    result = await callKeenon(() => discoverRobotMaps(client, robot, manual))
  } catch (err) {
    await db()
      .from('keenon_robot_scenes')
      .upsert({ robot_id: robot.id, discovery_error: err instanceof Error ? err.message : String(err) })
    throw err
  }

  const now = new Date().toISOString()
  const { error: sceneError } = await db()
    .from('keenon_robot_scenes')
    .upsert({
      robot_id: robot.id,
      discovered_at: now,
      discovery_error: result.warnings.length ? result.warnings.join(' · ') : null,
      ...(result.scene.source === 'detected'
        ? { detected_scene_code: result.scene.code, detected_scene_name: result.scene.name }
        : {}),
    })
  if (sceneError) throw sceneError

  // Upsert without app_floor_id/matched_at, so existing matches are kept.
  for (const floor of result.floors) {
    const { error } = await db()
      .from('keenon_robot_floors')
      .upsert(
        { robot_id: robot.id, scene_code: result.scene.code, ...floor, last_seen_at: now },
        { onConflict: 'robot_id,scene_code,floor' },
      )
    if (error) throw error
  }

  if (result.position) {
    const { error } = await db().from('robots').update({ position: result.position }).eq('id', robot.id)
    if (error) throw error
  }
  return json(await robotDetail(robot.id))
}

const sceneSchema = z.object({
  scene_code: z.string().trim().min(1).max(64).nullable(),
  scene_name: z.string().trim().max(200).nullable().optional(),
})

async function setScene(robotId: string, req: Request): Promise<Response> {
  const robot = await loadRobot(robotId)
  const { scene_code, scene_name } = await parseBody(req, sceneSchema)
  const { error } = await db()
    .from('keenon_robot_scenes')
    .upsert({ robot_id: robot.id, manual_scene_code: scene_code, manual_scene_name: scene_code ? (scene_name ?? null) : null })
  if (error) throw error
  return json(await robotDetail(robot.id))
}

async function listScenes(storeId: string): Promise<Response> {
  if (!storeId || storeId.length > 100) throw new HttpError(404, 'Store not found')
  const client = await keenonClient()
  const scenes = await callKeenon(() => getScenes(client, storeId))
  const body: KeenonScene[] = scenes
    .filter((s) => s.sceneCode)
    .map((s) => ({ code: s.sceneCode, name: s.sceneName ?? s.sceneCode }))
  return json(body)
}

const matchSchema = z.object({ app_floor_id: z.uuid().nullable() })

async function matchFloor(floorRowId: string, req: Request): Promise<Response> {
  if (!z.uuid().safeParse(floorRowId).success) throw new HttpError(404, 'Floor not found')
  const { app_floor_id } = await parseBody(req, matchSchema)
  if (app_floor_id) {
    const { data, error } = await db().from('floors').select('id').eq('id', app_floor_id).maybeSingle()
    if (error) throw error
    if (!data) throw new HttpError(400, 'That app floor no longer exists')
  }
  const { data, error } = await db()
    .from('keenon_robot_floors')
    .update({ app_floor_id, matched_at: app_floor_id ? new Date().toISOString() : null })
    .eq('id', floorRowId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Floor not found')
  return json(data as KeenonRobotFloor)
}

export default handler(async (req) => {
  await requireAdmin(req)
  // /api/keenon/<section>/<id>/<action>; parsed by hand (netlify dev retries 404s without params).
  const [, , section, id, action, ...rest] = new URL(req.url).pathname.split('/').filter(Boolean)
  if (rest.length) throw new HttpError(404, 'Not found')

  if (section === 'robots' && !id) {
    if (req.method !== 'GET') methodNotAllowed()
    return listRobots()
  }
  if (section === 'robots' && id) {
    switch (action) {
      case 'floors':
        if (req.method !== 'GET') methodNotAllowed()
        return json(await robotDetail(id))
      case 'discover':
        if (req.method !== 'POST') methodNotAllowed()
        return discover(id)
      case 'scene':
        if (req.method !== 'PUT') methodNotAllowed()
        return setScene(id, req)
    }
  }
  if (section === 'stores' && id && action === 'scenes') {
    if (req.method !== 'GET') methodNotAllowed()
    return listScenes(decodeURIComponent(id))
  }
  if (section === 'robot-floors' && id && !action) {
    if (req.method !== 'PUT') methodNotAllowed()
    return matchFloor(id, req)
  }
  throw new HttpError(404, 'Not found')
})

export const config: Config = {
  path: [
    '/api/keenon/robots',
    '/api/keenon/robots/:id/:action',
    '/api/keenon/stores/:id/scenes',
    '/api/keenon/robot-floors/:id',
  ],
}
