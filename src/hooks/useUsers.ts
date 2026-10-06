import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { AppUser, Role } from '../types/api'

const USERS_KEY = ['users']

export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: () => api<AppUser[]>('/api/users') })
}

function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: USERS_KEY })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: { username: string; password: string; role: Role }) =>
      api<AppUser>('/api/users', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: string) => api(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useResetPassword() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api(`/api/users/${id}/password`, { method: 'POST', body: { password } }),
    onSuccess: invalidate,
  })
}

export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api('/api/auth/password', { method: 'POST', body: input }),
  })
}
