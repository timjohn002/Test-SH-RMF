import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { FloorSelector } from '../components/map/FloorSelector'
import { PlanMap } from '../components/map/PlanMap'
import { RobotDots, robotLabel } from '../components/map/RobotDots'
import { ErrorBox, FullPageSpinner, cx, errorMessage } from '../components/ui'
import { useFloors } from '../hooks/useFloors'
import { useMapRobots } from '../hooks/useMapRobots'
import type { Floor, MapRobotsResponse } from '../types/api'

const SHOW_NAMES_KEY = 'map.showRobotNames'

/** Start on the lowest floor at or above ground level. `floors` is sorted highest first. */
function defaultFloor(floors: Floor[]): Floor | undefined {
  return floors.findLast((f) => f.level >= 0) ?? floors[0]
}

/** "Show robot names" setting, remembered per browser (best effort). Defaults to showing them. */
function useShowRobotNames(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(SHOW_NAMES_KEY) !== 'hide'
    } catch {
      return true
    }
  })
  function update(next: boolean) {
    setShow(next)
    try {
      localStorage.setItem(SHOW_NAMES_KEY, next ? 'show' : 'hide')
    } catch {
      // Storage unavailable: keep it for this visit only.
    }
  }
  return [show, update]
}

export function MapPage() {
  const { data: floors, isPending, error } = useFloors()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const mapRobots = useMapRobots()
  const [showNames, setShowNames] = useShowRobotNames()

  const robotCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of mapRobots.data?.robots ?? []) counts.set(r.floor_id, (counts.get(r.floor_id) ?? 0) + 1)
    return counts
  }, [mapRobots.data])

  if (isPending) return <FullPageSpinner />
  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorBox title="Could not load floors">{errorMessage(error)}</ErrorBox>
      </div>
    )
  }
  if (floors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">No floors yet</h2>
          <p className="mt-1 text-sm text-slate-500">Add your floors and upload their floor plans to get started.</p>
          <Link
            to="/setup"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Setup
          </Link>
        </div>
      </div>
    )
  }

  const floor = floors.find((f) => f.id === params.get('floor')) ?? defaultFloor(floors)!
  const robotsHere = mapRobots.data?.robots.filter((r) => r.floor_id === floor.id) ?? []

  return (
    <div className="flex h-full">
      <aside className="w-20 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-100 sm:w-24">
        <FloorSelector
          floors={floors}
          selectedId={floor.id}
          onSelect={(id) => setParams({ floor: id }, { replace: true })}
          robotCounts={robotCounts}
        />
      </aside>

      <section className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-[1000] -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-sm font-medium text-white shadow">
          {floor.name}
        </div>

        {floor.plan_url && floor.plan_width_px && floor.plan_height_px ? (
          <>
            <PlanMap
              mapKey={floor.id}
              planUrl={floor.plan_url}
              widthPx={floor.plan_width_px}
              heightPx={floor.plan_height_px}
              calibration={floor}
            >
              {/* Doors and elevators will be drawn here too once integrated. */}
              <RobotDots robots={robotsHere} showNames={showNames} />
            </PlanMap>
            <NamesToggle show={showNames} onChange={setShowNames} />
            {user?.role === 'admin' && mapRobots.data && <AdminRobotNotes data={mapRobots.data} />}
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-slate-600">This floor has no floor plan yet.</p>
              <Link to={`/setup?floor=${floor.id}`} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                Upload one in Setup
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function NamesToggle({ show, onChange }: { show: boolean; onChange: (show: boolean) => void }) {
  const option = (value: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={show === value}
      onClick={() => onChange(value)}
      className={cx('px-2 py-1', show === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50')}
    >
      {label}
    </button>
  )
  return (
    <div className="absolute right-2.5 top-12 z-[1000] flex items-center gap-1.5 rounded-md border-2 border-black/20 bg-white pl-2 text-xs font-medium text-slate-600">
      Robot names
      <div className="flex overflow-hidden border-l border-black/10">
        {option(true, 'Show')}
        {option(false, 'Hide')}
      </div>
    </div>
  )
}

/** For admins: robots that couldn't be drawn (and why), and vendor problems. */
function AdminRobotNotes({ data }: { data: MapRobotsResponse }) {
  const [open, setOpen] = useState(false)
  if (!data.not_shown.length && !data.warnings.length) return null
  const n = data.not_shown.length
  return (
    <div className="absolute bottom-2 right-2 z-[1000] max-w-sm text-xs">
      {open && (
        <div className="mb-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 shadow-lg">
          {data.warnings.map((w) => (
            <p key={w} className="mb-2 text-amber-800">
              {w}
            </p>
          ))}
          {n > 0 && (
            <ul className="space-y-1.5">
              {data.not_shown.map((r) => (
                <li key={r.id}>
                  {r.vendor === 'keenon' ? (
                    <Link to={`/vendors/keenon/robots/${r.id}`} className="font-medium text-blue-700 hover:underline">
                      {robotLabel(r)}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-800">{robotLabel(r)}</span>
                  )}{' '}
                  <span className="text-slate-400">({r.vendor_name})</span>: <span className="text-slate-600">{r.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cx(
          'ml-auto block rounded-full px-3 py-1 font-medium shadow',
          data.warnings.length ? 'bg-amber-100 text-amber-900' : 'bg-white/95 text-slate-700',
        )}
      >
        {n > 0 ? `${n} robot${n === 1 ? '' : 's'} not on the map` : 'Robot positions not updating'}
        {n > 0 && data.warnings.length > 0 && ' · positions not updating'}
      </button>
    </div>
  )
}
