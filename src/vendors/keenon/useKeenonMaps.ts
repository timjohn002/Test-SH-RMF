import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { KeenonRobotFloor, KeenonRobotMapSummary, KeenonRobotMapsDetail, KeenonScene } from './shared'

const ROBOTS_KEY = ['keenon-maps', 'robots']
const detailKey = (robotId: string) => ['keenon-maps', 'robot', robotId]

export function useKeenonMapRobots() {
  return useQuery({
    queryKey: ROBOTS_KEY,
    queryFn: () => api<KeenonRobotMapSummary[]>('/api/keenon/robots'),
  })
}

export function useKeenonRobotMaps(robotId: string) {
  return useQuery({
    queryKey: detailKey(robotId),
    queryFn: () => api<KeenonRobotMapsDetail>(`/api/keenon/robots/${robotId}/floors`),
  })
}

/** Mutations returning the robot's full detail refresh both the page and the summary list. */
function useDetailMutation<V>(robotId: string, fn: (vars: V) => Promise<KeenonRobotMapsDetail>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => queryClient.setQueryData(detailKey(robotId), detail),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ROBOTS_KEY }),
  })
}

export function useDiscoverRobotMaps(robotId: string) {
  return useDetailMutation<void>(robotId, () =>
    api<KeenonRobotMapsDetail>(`/api/keenon/robots/${robotId}/discover`, { method: 'POST' }),
  )
}

export function useSetRobotScene(robotId: string) {
  return useDetailMutation<{ scene_code: string | null; scene_name?: string | null }>(robotId, (body) =>
    api<KeenonRobotMapsDetail>(`/api/keenon/robots/${robotId}/scene`, { method: 'PUT', body }),
  )
}

export function useStoreScenes(storeId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['keenon-maps', 'scenes', storeId],
    queryFn: () => api<KeenonScene[]>(`/api/keenon/stores/${encodeURIComponent(storeId!)}/scenes`),
    enabled: enabled && !!storeId,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useMatchFloor(robotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ floorId, appFloorId }: { floorId: string; appFloorId: string | null }) =>
      api<KeenonRobotFloor>(`/api/keenon/robot-floors/${floorId}`, {
        method: 'PUT',
        body: { app_floor_id: appFloorId },
      }),
    onSuccess: (floor) => {
      queryClient.setQueryData<KeenonRobotMapsDetail>(detailKey(robotId), (detail) =>
        detail && { ...detail, floors: detail.floors.map((f) => (f.id === floor.id ? floor : f)) },
      )
      queryClient.invalidateQueries({ queryKey: ROBOTS_KEY })
    },
  })
}
