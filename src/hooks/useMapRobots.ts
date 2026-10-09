import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { MapRobotsResponse } from '../types/api'

/**
 * Robots placed on the app's floors (all vendors). Every 5 s the server also asks the
 * vendors for fresh positions; polling pauses while the tab is in the background.
 */
export function useMapRobots() {
  return useQuery({
    queryKey: ['map-robots'],
    queryFn: () => api<MapRobotsResponse>('/api/map/robots'),
    refetchInterval: 5_000,
  })
}
