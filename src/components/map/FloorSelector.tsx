import type { Floor } from '../../types/api'
import { cx } from '../ui'

/** Elevator-panel style floor buttons. Expects floors sorted highest level first. */
export function FloorSelector({
  floors,
  selectedId,
  onSelect,
}: {
  floors: Floor[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  return (
    <nav aria-label="Floors" className="flex flex-col gap-2 p-2">
      {floors.map((floor) => {
        const active = floor.id === selectedId
        return (
          <button
            key={floor.id}
            type="button"
            onClick={() => onSelect(floor.id)}
            aria-current={active ? 'true' : undefined}
            title={floor.name}
            className={cx(
              'flex flex-col items-center rounded-lg border px-1 py-2 transition-colors',
              active
                ? 'border-blue-600 bg-blue-600 text-white shadow'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50',
            )}
          >
            <span className="text-lg font-semibold leading-none">{floor.level}</span>
            <span className={cx('mt-1 w-full truncate text-[11px]', active ? 'text-blue-100' : 'text-slate-500')}>
              {floor.name}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
