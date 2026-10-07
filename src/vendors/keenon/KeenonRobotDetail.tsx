import type { Robot } from '../../types/api'

interface CleaningStatus {
  kind: 'cleaning'
  sub_state_label?: string | null
  global_state?: { faulting?: boolean; scram?: boolean; locationSuc?: boolean } | null
}

function cleaningStatus(robot: Robot): CleaningStatus | null {
  const status = robot.vendor_status as Partial<CleaningStatus> | null
  return status?.kind === 'cleaning' ? (status as CleaningStatus) : null
}

/** Keenon-specific detail on the Robots page: cleaning robots' activity and alarms. */
export function KeenonRobotDetail({ robot }: { robot: Robot }) {
  const cleaning = cleaningStatus(robot)
  if (!cleaning) return null

  const alarms = [
    cleaning.global_state?.scram && 'Emergency stop',
    cleaning.global_state?.faulting && 'Fault',
    cleaning.global_state?.locationSuc === false && 'Lost position',
  ].filter(Boolean) as string[]

  return (
    <div className="mt-1 space-y-0.5 text-xs">
      {cleaning.sub_state_label && <div className="text-slate-600">Cleaning robot · {cleaning.sub_state_label}</div>}
      {alarms.length > 0 && <div className="font-medium text-red-700">{alarms.join(' · ')}</div>}
    </div>
  )
}
