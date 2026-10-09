import type { Floor } from '../../types/api'
import { cx } from '../ui'

/** Elevator-panel style floor buttons. Expects floors sorted highest level first. */
export function FloorSelector({
  floors,
  selectedId,
  onSelect,
  robotCounts,
}: {
  floors: Floor[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  /** Robots on each floor (by floor id), shown as a badge. */
  robotCounts?: Map<string, number>
}) {
  return (
    <nav aria-label="Floors" className="flex flex-col gap-2 p-2">
      {floors.map((floor) => {
        const active = floor.id === selectedId
        const robots = robotCounts?.get(floor.id) ?? 0
        return (
          <button
            key={floor.id}
            type="button"
            onClick={() => onSelect(floor.id)}
            aria-current={active ? 'true' : undefined}
            title={robots ? `${floor.name}: ${robots} robot${robots === 1 ? '' : 's'}` : floor.name}
            className={cx(
              'relative flex flex-col items-center rounded-lg border px-1 py-2 transition-colors',
              active
                ? 'border-blue-600 bg-blue-600 text-white shadow'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50',
            )}
          >
            {robots > 0 && (
              <span
                aria-label={`${robots} robot${robots === 1 ? '' : 's'}`}
                className={cx(
                  'absolute -right-1 -top-1 min-w-4 rounded-full px-1 text-[10px] font-semibold leading-4',
                  active ? 'bg-white text-blue-700 ring-1 ring-blue-600' : 'bg-blue-600 text-white',
                )}
              >
                {robots}
              </span>
            )}
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
