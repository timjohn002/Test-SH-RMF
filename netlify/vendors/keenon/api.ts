import type { KeenonClient } from './client'
import type { KeenonRobot, KeenonRobotStatus, KeenonStore } from './types'

/** Keenon returns lists either bare or wrapped as `{ list: [...] }`. */
function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && Array.isArray((data as { list?: unknown }).list)) {
    return (data as { list: T[] }).list
  }
  return []
}

export async function getStores(client: KeenonClient): Promise<KeenonStore[]> {
  return asList<KeenonStore>(await client.get('/api/open/data/v1/store/list'))
}

export async function getRobots(client: KeenonClient, storeId: string): Promise<KeenonRobot[]> {
  return asList<KeenonRobot>(await client.get('/api/open/data/v1/store/robot/list', { storeId }))
}

export async function getRobotStatus(client: KeenonClient, robotId: string): Promise<KeenonRobotStatus | null> {
  const data = await client.get<unknown>('/api/open/scene/v1/robot/status', { robotId })
  const list = asList<KeenonRobotStatus>(data)
  if (list.length) return list[0]
  return data && typeof data === 'object' ? (data as KeenonRobotStatus) : null
}

export async function getBatteryLevel(client: KeenonClient, robotSn: string): Promise<number | null> {
  const data = await client.get<{ batteryLevel?: number }>('/api/open/custom/robot/battery/level', { robotSn })
  return typeof data?.batteryLevel === 'number' ? data.batteryLevel : null
}

export async function getCleanStatus(client: KeenonClient, robotSn: string): Promise<Record<string, unknown> | null> {
  const data = await client.get<unknown>('/api/open/custom/clean/robot/status', { robotSn })
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
}
