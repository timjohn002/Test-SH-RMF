import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FloorEditor, NewFloorForm } from '../components/setup/FloorForm'
import { FloorList } from '../components/setup/FloorList'
import { Button, ErrorBox, FullPageSpinner, errorMessage } from '../components/ui'
import { useFloors } from '../hooks/useFloors'

export function SetupPage() {
  const { data: floors, isPending, error } = useFloors()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)

  if (isPending) return <FullPageSpinner />
  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorBox title="Could not load floors">{errorMessage(error)}</ErrorBox>
      </div>
    )
  }

  const selected = floors.find((f) => f.id === params.get('floor')) ?? floors[0]
  const showCreate = creating || floors.length === 0
  const suggestedLevel = floors.length ? Math.max(...floors.map((f) => f.level)) + 1 : 1

  function select(id: string) {
    setCreating(false)
    setParams({ floor: id }, { replace: true })
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex max-h-64 shrink-0 flex-col border-b border-slate-200 bg-white md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Floors</h2>
          <Button size="sm" onClick={() => setCreating(true)}>
            + Add floor
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FloorList floors={floors} selectedId={showCreate ? undefined : selected?.id} onSelect={select} />
        </div>
      </aside>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {showCreate ? (
          <NewFloorForm
            suggestedLevel={suggestedLevel}
            onCreated={(floor) => select(floor.id)}
            onCancel={() => setCreating(false)}
          />
        ) : (
          selected && <FloorEditor key={selected.id} floor={selected} onDeleted={() => setParams({}, { replace: true })} />
        )}
      </div>
    </div>
  )
}
