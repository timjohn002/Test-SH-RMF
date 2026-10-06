import type { Floor } from '../../types/api'
import { cx } from '../ui'

export function FloorList({
  floors,
  selectedId,
  onSelect,
}: {
  floors: Floor[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  if (floors.length === 0) {
    return <p className="px-4 py-6 text-sm text-slate-500">No floors yet. Add your first floor to begin.</p>
  }

  return (
    <ul className="space-y-1 p-2">
      {floors.map((floor) => (
        <li key={floor.id}>
          <button
            type="button"
            onClick={() => onSelect(floor.id)}
            className={cx(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
              floor.id === selectedId ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-100',
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-800 text-sm font-semibold text-white">
              {floor.level}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{floor.name}</span>
              <span className={cx('block text-xs', floor.plan_path ? 'text-slate-500' : 'text-amber-600')}>
                {floor.plan_path ? `Plan ${floor.plan_width_px} × ${floor.plan_height_px} px` : 'No floor plan'}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
