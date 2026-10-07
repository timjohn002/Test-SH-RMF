import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { RobotsResponse } from '../types/api'

const ROBOTS_KEY = ['robots']

/** Robots grouped by vendor; refreshed every 10 s because callbacks update them in the background. */
export function useRobots() {
  return useQuery({
    queryKey: ROBOTS_KEY,
    queryFn: () => api<RobotsResponse>('/api/robots'),
    refetchInterval: 10_000,
  })
}

/** Ask one vendor's cloud for the current status of all its robots. */
export function useRefreshVendorRobots() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vendorId: string) =>
      api<{ robots: number }>(`/api/robots/vendors/${vendorId}/refresh`, { method: 'POST' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ROBOTS_KEY }),
  })
}
