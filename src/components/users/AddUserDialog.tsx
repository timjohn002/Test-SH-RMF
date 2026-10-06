import { useState, type FormEvent } from 'react'
import { useCreateUser } from '../../hooks/useUsers'
import type { Role } from '../../types/api'
import { Button, ErrorBox, Modal, TextField, errorMessage } from '../ui'
import { PasswordInput } from './PasswordInput'

export function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateUser()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')

  function close() {
    setUsername('')
    setPassword('')
    setRole('user')
    create.reset()
    onClose()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate({ username, password, role }, { onSuccess: close })
  }

  return (
    <Modal open={open} title="Add user" onClose={close}>
      <form onSubmit={onSubmit} className="space-y-4">
        {create.error && <ErrorBox>{errorMessage(create.error)}</ErrorBox>}
        <TextField
          label="Username"
          autoComplete="off"
          autoCapitalize="none"
          autoFocus
          required
          pattern="[A-Za-z0-9._\-]{3,32}"
          hint="3–32 characters: letters, numbers, . _ - (stored in lowercase)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <PasswordInput label="Password" value={password} onChange={setPassword} />
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Role</legend>
          <div className="space-y-1.5">
            {(
              [
                ['user', 'User', 'Can use the map and setup pages.'],
                ['admin', 'Admin', 'Everything a user can do, plus manage user accounts.'],
              ] as const
            ).map(([value, label, description]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2.5 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-slate-500">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-slate-500">
          Passwords are stored as one-way hashes and can't be viewed later. Copy it now to give to the user.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add user'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
