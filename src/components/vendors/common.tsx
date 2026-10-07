import { useState } from 'react'
import type { VendorStatus } from '../../types/api'
import { Badge, Button, type BadgeTone } from '../ui'

const STATUS: Record<VendorStatus, { tone: BadgeTone; label: string }> = {
  not_configured: { tone: 'slate', label: 'Not configured' },
  disabled: { tone: 'amber', label: 'Disabled' },
  connected: { tone: 'green', label: 'Connected' },
  error: { tone: 'red', label: 'Error' },
}

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
}

/** Read-only value with a copy button (e.g. a webhook URL). */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex gap-1.5">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className="block w-full min-w-0 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
          }
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
