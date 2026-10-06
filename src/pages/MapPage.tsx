import { LayerGroup } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import { FloorSelector } from '../components/map/FloorSelector'
import { PlanMap } from '../components/map/PlanMap'
import { ErrorBox, FullPageSpinner, errorMessage } from '../components/ui'
import { useFloors } from '../hooks/useFloors'
import type { Floor } from '../types/api'

/** Start on the lowest floor at or above ground level. `floors` is sorted highest first. */
function defaultFloor(floors: Floor[]): Floor | undefined {
  return floors.findLast((f) => f.level >= 0) ?? floors[0]
}

export function MapPage() {
  const { data: floors, isPending, error } = useFloors()
  const [params, setParams] = useSearchParams()

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

  return (
    <div className="flex h-full">
      <aside className="w-20 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-100 sm:w-24">
        <FloorSelector
          floors={floors}
          selectedId={floor.id}
          onSelect={(id) => setParams({ floor: id }, { replace: true })}
        />
      </aside>

      <section className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-[1000] -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-sm font-medium text-white shadow">
          {floor.name}
        </div>

        {floor.plan_url && floor.plan_width_px && floor.plan_height_px ? (
          <PlanMap
            mapKey={floor.id}
            planUrl={floor.plan_url}
            widthPx={floor.plan_width_px}
            heightPx={floor.plan_height_px}
            calibration={floor}
          >
            {/* Robots, doors and elevators will be drawn here once integrated. */}
            <LayerGroup />
          </PlanMap>
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
