import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ErrorBox, FullPageSpinner } from '../components/ui'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, error } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorBox title="Can't reach the server">{error.message}</ErrorBox>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return children
}
