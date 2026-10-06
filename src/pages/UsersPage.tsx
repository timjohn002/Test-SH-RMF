import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Button, ErrorBox, FullPageSpinner, cx, errorMessage } from '../components/ui'
import { AddUserDialog } from '../components/users/AddUserDialog'
import { ResetPasswordDialog } from '../components/users/ResetPasswordDialog'
import { useDeleteUser, useUsers } from '../hooks/useUsers'
import type { AppUser } from '../types/api'

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : 'Never'
}

export function UsersPage() {
  const { user: me } = useAuth()
  const { data: users, isPending, error } = useUsers()
  const remove = useDeleteUser()
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<AppUser | null>(null)

  if (isPending) return <FullPageSpinner />

  const adminCount = users?.filter((u) => u.role === 'admin').length ?? 0

  function onDelete(user: AppUser) {
    if (confirm(`Delete the account "${user.username}"? They will be signed out immediately.`)) {
      remove.mutate(user.id)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">User management</h1>
            <p className="text-sm text-slate-500">Add and remove accounts, and reset forgotten passwords.</p>
          </div>
          <Button onClick={() => setAdding(true)}>+ Add user</Button>
        </div>

        {(error || remove.error) && <ErrorBox>{errorMessage(error ?? remove.error)}</ErrorBox>}

        {users && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Username</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isMe = u.id === me?.id
                  const lastAdmin = u.role === 'admin' && adminCount <= 1
                  const locked = u.locked_until && new Date(u.locked_until) > new Date()
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium">
                        {u.username}
                        {isMe && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                        {locked && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800">
                            Locked
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            'rounded px-2 py-0.5 text-xs font-medium',
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700',
                          )}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(u.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(u.last_login_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setResetting(u)}>
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          disabled={isMe || lastAdmin || remove.isPending}
                          title={isMe ? "You can't delete yourself" : lastAdmin ? "Can't delete the last admin" : undefined}
                          onClick={() => onDelete(u)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddUserDialog open={adding} onClose={() => setAdding(false)} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </div>
  )
}
