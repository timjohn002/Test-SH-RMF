import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Floor, PlanUploadTicket } from '../types/api'

const FLOORS_KEY = ['floors']

export type FloorInput = Pick<Floor, 'name' | 'level' | 'elevation_m'>
export type FloorPatch = Partial<
  Pick<
    Floor,
    | 'name'
    | 'level'
    | 'elevation_m'
    | 'scale_m_per_px'
    | 'origin_x_px'
    | 'origin_y_px'
    | 'plan_path'
    | 'plan_width_px'
    | 'plan_height_px'
  >
>

/** All floors, highest level first. Plan image URLs are signed for one hour. */
export function useFloors() {
  return useQuery({
    queryKey: FLOORS_KEY,
    queryFn: () => api<Floor[]>('/api/floors'),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

function useInvalidateFloors() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: FLOORS_KEY })
}

export function useCreateFloor() {
  const invalidate = useInvalidateFloors()
  return useMutation({
    mutationFn: (input: FloorInput) => api<Floor>('/api/floors', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useUpdateFloor() {
  const invalidate = useInvalidateFloors()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FloorPatch }) =>
      api<Floor>(`/api/floors/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: invalidate,
  })
}

export function useDeleteFloor() {
  const invalidate = useInvalidateFloors()
  return useMutation({
    mutationFn: (id: string) => api(`/api/floors/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not read the image file'))
    })
    img.src = url
    await loaded
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error('Could not determine the image size (SVG files need width and height attributes)')
    }
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Upload straight to Supabase Storage via a signed URL, then attach it to the floor. */
export function useUploadPlan() {
  const invalidate = useInvalidateFloors()
  return useMutation({
    mutationFn: async ({ floorId, file }: { floorId: string; file: File }) => {
      const { width, height } = await readImageSize(file)
      const ticket = await api<PlanUploadTicket>(`/api/floors/${floorId}/plan-upload-url`, {
        method: 'POST',
        body: { fileName: file.name, contentType: file.type },
      })
      const upload = await fetch(ticket.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!upload.ok) {
        const detail = await upload.json().catch(() => null)
        throw new Error(`Upload failed: ${detail?.message ?? upload.statusText}`)
      }
      return api<Floor>(`/api/floors/${floorId}`, {
        method: 'PATCH',
        body: { plan_path: ticket.path, plan_width_px: width, plan_height_px: height },
      })
    },
    onSuccess: invalidate,
  })
}
