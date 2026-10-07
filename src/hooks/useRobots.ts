import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Robot, RobotsResponse } from '../types/api'

const ROBOTS_KEY = ['robots']

/** Robots grouped by vendor; refreshed every 10 s because callbacks update them in the background. */
export function useRobots() {
  return useQuery({
    queryKey: ROBOTS_KEY,
    queryFn: () => api<RobotsResponse>('/api/robots'),
    refetchInterval: 10_000,
  })
}

export function useRefreshRobot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<Robot>(`/api/robots/${id}/refresh`, { method: 'POST' }),
    onSuccess: (robot) =>
      queryClient.setQueryData<RobotsResponse>(ROBOTS_KEY, (data) =>
        data && {
          groups: data.groups.map((g) =>
            g.vendor.id === robot.vendor
              ? { ...g, robots: g.robots.map((r) => (r.id === robot.id ? robot : r)) }
              : g,
          ),
        },
      ),
  })
}
