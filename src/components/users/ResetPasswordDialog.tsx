import { useState, type FormEvent } from 'react'
import { useResetPassword } from '../../hooks/useUsers'
import type { AppUser } from '../../types/api'
import { Button, ErrorBox, Modal, errorMessage } from '../ui'
import { PasswordInput } from './PasswordInput'

export function ResetPasswordDialog({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  const reset = useResetPassword()
  const [password, setPassword] = useState('')

  function close() {
    setPassword('')
    reset.reset()
    onClose()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (user) reset.mutate({ id: user.id, password }, { onSuccess: close })
  }

  return (
    <Modal open={!!user} title={`Reset password for ${user?.username ?? ''}`} onClose={close}>
      <form onSubmit={onSubmit} className="space-y-4">
        {reset.error && <ErrorBox>{errorMessage(reset.error)}</ErrorBox>}
        <PasswordInput label="New password" value={password} onChange={setPassword} />
        <p className="text-xs text-slate-500">This also unlocks the account if it was locked after failed sign-ins.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={reset.isPending}>
            {reset.isPending ? 'Saving…' : 'Set password'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
