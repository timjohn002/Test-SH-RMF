import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { ApiError, UNAUTHORIZED_EVENT, api } from '../lib/api'
import type { SessionUser } from '../types/api'

interface AuthState {
  user: SessionUser | null
  loading: boolean
  error: Error | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const ME_KEY = ['me']

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<SessionUser>('/api/auth/me')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    staleTime: Infinity,
    retry: false,
  })

  const setSession = useCallback(
    (user: SessionUser | null) => {
      // Drop cached data from the previous session, keep the `me` query observer alive.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] })
      queryClient.setQueryData(ME_KEY, user)
    },
    [queryClient],
  )

  useEffect(() => {
    const onUnauthorized = () => setSession(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [setSession])

  const value = useMemo<AuthState>(
    () => ({
      user: me.data ?? null,
      loading: me.isPending,
      error: me.error,
      login: async (username, password) => {
        setSession(await api<SessionUser>('/api/auth/login', { method: 'POST', body: { username, password } }))
      },
      logout: async () => {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
        setSession(null)
      },
    }),
    [me.data, me.isPending, me.error, setSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
