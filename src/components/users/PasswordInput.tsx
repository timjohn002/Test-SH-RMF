import { useId, useState } from 'react'
import { generatePassword } from '../../lib/password'
import { Button } from '../ui'

/** Password field with Generate / Show / Copy, for admins setting someone else's password. */
export function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex gap-1.5">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={value}
          onChange={(e) => {
            setCopied(false)
            onChange(e.target.value)
          }}
          className="block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        <Button size="sm" variant="secondary" onClick={() => setVisible((v) => !v)}>
          {visible ? 'Hide' : 'Show'}
        </Button>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(generatePassword())
            setVisible(true)
            setCopied(false)
          }}
        >
          Generate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!value}
          onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <span className="text-xs text-slate-500">At least 8 characters</span>
      </div>
    </div>
  )
}
