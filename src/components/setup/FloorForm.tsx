import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useCreateFloor, useDeleteFloor, useUpdateFloor, useUploadPlan, type FloorPatch } from '../../hooks/useFloors'
import type { PlanCalibration } from '../../lib/coords'
import type { Floor } from '../../types/api'
import { Button, ErrorBox, TextField, errorMessage } from '../ui'
import { CalibrationMap } from './CalibrationMap'

const PLAN_ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// New floor
// ---------------------------------------------------------------------------

export function NewFloorForm({
  suggestedLevel,
  onCreated,
  onCancel,
}: {
  suggestedLevel: number
  onCreated: (floor: Floor) => void
  onCancel: () => void
}) {
  const create = useCreateFloor()
  const [name, setName] = useState('')
  const [level, setLevel] = useState(String(suggestedLevel))
  const [elevation, setElevation] = useState('0')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate(
      { name: name.trim(), level: Number(level), elevation_m: Number(elevation) },
      { onSuccess: onCreated },
    )
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <h2 className="text-xl font-semibold">Add floor</h2>
      <Section title="Floor details" description="You can upload the floor plan after the floor is created.">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Name"
            className="sm:col-span-3"
            placeholder="e.g. Level 1 – Lobby"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Level"
            type="number"
            step="1"
            required
            hint="Sort order. Higher = upper floor."
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          <TextField
            label="Elevation (m)"
            type="number"
            step="any"
            required
            value={elevation}
            onChange={(e) => setElevation(e.target.value)}
          />
        </div>
      </Section>
      {create.error && <ErrorBox>{errorMessage(create.error)}</ErrorBox>}
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create floor'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Edit floor
// ---------------------------------------------------------------------------

interface Draft {
  name: string
  level: string
  elevation_m: string
  scale_m_per_px: string
  origin_x_px: string
  origin_y_px: string
}

function toDraft(f: Floor): Draft {
  return {
    name: f.name,
    level: String(f.level),
    elevation_m: String(f.elevation_m),
    scale_m_per_px: String(f.scale_m_per_px),
    origin_x_px: String(f.origin_x_px),
    origin_y_px: String(f.origin_y_px),
  }
}

type Parsed = Required<Pick<FloorPatch, 'name' | 'level' | 'elevation_m'>> & PlanCalibration

function parseDraft(d: Draft): { values: Parsed } | { error: string } {
  const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
  const values: Parsed = {
    name: d.name.trim(),
    level: num(d.level),
    elevation_m: num(d.elevation_m),
    scale_m_per_px: num(d.scale_m_per_px),
    origin_x_px: num(d.origin_x_px),
    origin_y_px: num(d.origin_y_px),
  }
  if (!values.name) return { error: 'Name is required' }
  if (!Number.isInteger(values.level)) return { error: 'Level must be a whole number' }
  if (!Number.isFinite(values.elevation_m)) return { error: 'Elevation must be a number' }
  if (!(values.scale_m_per_px > 0)) return { error: 'Scale must be a number greater than 0' }
  if (!Number.isFinite(values.origin_x_px) || !Number.isFinite(values.origin_y_px)) {
    return { error: 'Origin must be numbers' }
  }
  return { values }
}

const round = (n: number, digits: number) => String(Number(n.toFixed(digits)))

export function FloorEditor({ floor, onDeleted }: { floor: Floor; onDeleted: () => void }) {
  const update = useUpdateFloor()
  const upload = useUploadPlan()
  const remove = useDeleteFloor()
  const fileInput = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(() => toDraft(floor))
  const [saved, setSaved] = useState(false)

  const parsed = parseDraft(draft)
  const values = 'values' in parsed ? parsed.values : null
  const dirty =
    !values ||
    (Object.keys(values) as (keyof Parsed)[]).some((k) => values[k] !== floor[k])
  const calibration: PlanCalibration = values ?? floor
  const hasPlan = !!(floor.plan_url && floor.plan_width_px && floor.plan_height_px)

  function set<K extends keyof Draft>(key: K, value: string) {
    setSaved(false)
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function onSave(e: FormEvent) {
    e.preventDefault()
    if (!values) return
    update.mutate({ id: floor.id, patch: values }, { onSuccess: () => setSaved(true) })
  }

  function onRemovePlan() {
    if (!confirm('Remove the floor plan image from this floor?')) return
    update.mutate({ id: floor.id, patch: { plan_path: null } })
  }

  function onDelete() {
    if (!confirm(`Delete "${floor.name}" and its floor plan? This cannot be undone.`)) return
    remove.mutate(floor.id, { onSuccess: onDeleted })
  }

  const actionError = update.error ?? upload.error ?? remove.error

  return (
    <form onSubmit={onSave} className="max-w-5xl space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">{floor.name}</h2>
        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Level {floor.level}</span>
      </div>

      <Section title="Floor details">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Name" required value={draft.name} onChange={(e) => set('name', e.target.value)} />
          <TextField
            label="Level"
            type="number"
            step="1"
            required
            hint="Sort order. Higher = upper floor."
            value={draft.level}
            onChange={(e) => set('level', e.target.value)}
          />
          <TextField
            label="Elevation (m)"
            type="number"
            step="any"
            required
            value={draft.elevation_m}
            onChange={(e) => set('elevation_m', e.target.value)}
          />
        </div>
      </Section>

      <Section title="Floor plan" description="PNG, JPG, WebP or SVG. Robot occupancy maps exported as PNG work well.">
        <input
          ref={fileInput}
          type="file"
          accept={PLAN_ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) upload.mutate({ floorId: floor.id, file })
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={hasPlan ? 'secondary' : 'primary'} disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
            {upload.isPending ? 'Uploading…' : hasPlan ? 'Replace plan' : 'Upload plan'}
          </Button>
          {floor.plan_path && (
            <Button variant="ghost" disabled={update.isPending} onClick={onRemovePlan}>
              Remove plan
            </Button>
          )}
          {hasPlan && (
            <span className="text-sm text-slate-500">
              {floor.plan_width_px} × {floor.plan_height_px} px
            </span>
          )}
        </div>
        {hasPlan && (
          <p className="mt-2 text-xs text-slate-500">After replacing a plan with a different image, re-check the calibration below.</p>
        )}
      </Section>

      {hasPlan && (
        <Section
          title="Calibration"
          description="Tell the map how big the plan is in real life and where world (0, 0) is, so robot positions in meters land in the right place."
        >
          <CalibrationMap
            floor={floor}
            calibration={calibration}
            onScale={(s) => set('scale_m_per_px', round(s, 8))}
            onOrigin={(p) => {
              set('origin_x_px', round(p.x, 2))
              set('origin_y_px', round(p.y, 2))
            }}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <TextField
              label="Scale (meters per pixel)"
              type="number"
              step="any"
              min="0"
              required
              hint={values ? `${round(1 / values.scale_m_per_px, 2)} pixels per meter` : undefined}
              value={draft.scale_m_per_px}
              onChange={(e) => set('scale_m_per_px', e.target.value)}
            />
            <TextField
              label="Origin X (px from left)"
              type="number"
              step="any"
              required
              value={draft.origin_x_px}
              onChange={(e) => set('origin_x_px', e.target.value)}
            />
            <TextField
              label="Origin Y (px from top)"
              type="number"
              step="any"
              required
              value={draft.origin_y_px}
              onChange={(e) => set('origin_y_px', e.target.value)}
            />
          </div>
        </Section>
      )}

      {actionError && <ErrorBox>{errorMessage(actionError)}</ErrorBox>}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/95 px-1 py-3 backdrop-blur">
        <Button type="submit" disabled={!dirty || !values || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          variant="secondary"
          disabled={!dirty}
          onClick={() => {
            setDraft(toDraft(floor))
            update.reset()
          }}
        >
          Discard
        </Button>
        {'error' in parsed && <span className="text-sm text-red-600">{parsed.error}</span>}
        {saved && !dirty && <span className="text-sm text-green-700">Saved</span>}
        <Button variant="danger" className="ml-auto" disabled={remove.isPending} onClick={onDelete}>
          Delete floor
        </Button>
      </div>
    </form>
  )
}
