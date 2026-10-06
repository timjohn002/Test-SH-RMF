import { useState, type FormEvent } from 'react'
import { useChangeOwnPassword } from '../hooks/useUsers'
import { Button, ErrorBox, Modal, TextField, errorMessage } from './ui'

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const change = useChangeOwnPassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function close() {
    setCurrent('')
    setNext('')
    setConfirm('')
    setLocalError(null)
    setDone(false)
    change.reset()
    onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (next !== confirm) return setLocalError('New passwords do not match')
    await change.mutateAsync({ currentPassword: current, newPassword: next }).then(
      () => setDone(true),
      () => {},
    )
  }

  return (
    <Modal open={open} title="Change password" onClose={close}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">Your password has been changed.</p>
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {(localError || change.error) && <ErrorBox>{localError ?? errorMessage(change.error)}</ErrorBox>}
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? 'Saving…' : 'Change password'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
