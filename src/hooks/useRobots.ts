import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Robot } from '../types/api'

const ROBOTS_KEY = ['robots']

/** All robots; refreshed every 10 s because callbacks update them in the background. */
export function useRobots() {
  return useQuery({
    queryKey: ROBOTS_KEY,
    queryFn: () => api<Robot[]>('/api/robots'),
    refetchInterval: 10_000,
  })
}

export function useRefreshRobot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<Robot>(`/api/robots/${id}/refresh`, { method: 'POST' }),
    onSuccess: (robot) =>
      queryClient.setQueryData<Robot[]>(ROBOTS_KEY, (list) => list?.map((r) => (r.id === robot.id ? robot : r))),
  })
}
