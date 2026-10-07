import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Badge, Button, ErrorBox, FullPageSpinner, cx, errorMessage, type BadgeTone } from '../components/ui'
import { useRefreshRobot, useRobots } from '../hooks/useRobots'
import { formatDateTime, timeAgo } from '../lib/format'
import type { Robot, RobotTask, WorkState } from '../types/api'

const WORK_STATE: Record<WorkState, { tone: BadgeTone; label: string }> = {
  idle: { tone: 'green', label: 'Idle' },
  busy: { tone: 'blue', label: 'On task' },
  charging: { tone: 'amber', label: 'Charging' },
  operating: { tone: 'purple', label: 'Operating' },
  scheduling: { tone: 'purple', label: 'Scheduling' },
  starting: { tone: 'slate', label: 'Starting up' },
  offline: { tone: 'slate', label: 'Offline' },
  unknown: { tone: 'slate', label: 'Unknown' },
}

const TASK_TONE: Record<string, BadgeTone> = {
  completed: 'green',
  failed: 'red',
  cancelled: 'slate',
  in_progress: 'blue',
  calling: 'blue',
  queued: 'amber',
  waiting: 'amber',
  arrived: 'green',
}

export function RobotsPage() {
  const { user } = useAuth()
  const { data: robots, isPending, error, dataUpdatedAt } = useRobots()
  const refresh = useRefreshRobot()
  const [refreshError, setRefreshError] = useState<string | null>(null)

  if (isPending) return <FullPageSpinner />

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Robots</h1>
            <p className="text-sm text-slate-500">
              Live status from vendor callbacks. Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}, refreshes
              every 10 s.
            </p>
          </div>
        </div>

        {error && <ErrorBox>{errorMessage(error)}</ErrorBox>}
        {refreshError && <ErrorBox title="Refresh failed">{refreshError}</ErrorBox>}

        {robots && robots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="font-semibold">No robots yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Robots appear here after a vendor is configured and synced, or when a vendor sends a callback.
            </p>
            {user?.role === 'admin' && (
              <Link to="/vendors" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                Configure robot vendors
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Robot</th>
                  <th className="px-4 py-2.5 font-medium">Store</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Battery</th>
                  <th className="px-4 py-2.5 font-medium">Current task</th>
                  <th className="px-4 py-2.5 font-medium">Last seen</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {robots?.map((robot) => (
                  <RobotRow
                    key={robot.id}
                    robot={robot}
                    refreshing={refresh.isPending && refresh.variables === robot.id}
                    onRefresh={() => {
                      setRefreshError(null)
                      refresh.mutate(robot.id, { onError: (e) => setRefreshError(errorMessage(e)) })
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function RobotRow({ robot, refreshing, onRefresh }: { robot: Robot; refreshing: boolean; onRefresh: () => void }) {
  const state = WORK_STATE[robot.work_state] ?? WORK_STATE.unknown
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{robot.name ?? robot.external_id}</div>
        <div className="font-mono text-xs text-slate-500">{robot.external_id}</div>
        <div className="text-xs text-slate-500">
          <span className="capitalize">{robot.vendor}</span>
          {robot.model && ` · ${robot.model}`}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">{robot.store_name ?? robot.store_external_id ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              'size-2.5 shrink-0 rounded-full',
              robot.online === true ? 'bg-green-500' : robot.online === false ? 'bg-slate-300' : 'bg-slate-200',
            )}
            title={robot.online === true ? 'Online' : robot.online === false ? 'Offline' : 'Unknown'}
          />
          <Badge tone={state.tone}>{state.label}</Badge>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {robot.can_be_called === true ? 'Callable' : robot.can_be_called === false ? 'Not callable' : ''}
          {robot.online_type && `${robot.can_be_called !== null ? ' · ' : ''}${robot.online_type}`}
        </div>
      </td>
      <td className="px-4 py-3">
        <BatteryBar level={robot.battery} charging={robot.charging} />
      </td>
      <td className="px-4 py-3">
        <TaskSummary task={robot.current_task} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-600" title={formatDateTime(robot.last_seen_at)}>
        {timeAgo(robot.last_seen_at)}
      </td>
      <td className="px-4 py-3 text-right">
        <Button size="sm" variant="ghost" disabled={refreshing} onClick={onRefresh} title="Ask the vendor for live status">
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </td>
    </tr>
  )
}

function BatteryBar({ level, charging }: { level: number | null; charging: boolean | null }) {
  if (level === null) return <span className="text-slate-400">—</span>
  const pct = Math.max(0, Math.min(100, level))
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cx('h-full rounded-full', pct <= 15 ? 'bg-red-500' : pct <= 35 ? 'bg-amber-500' : 'bg-green-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums text-slate-700">{pct}%</span>
      {charging && <span className="text-xs text-amber-700">charging</span>}
    </div>
  )
}

function TaskSummary({ task }: { task: RobotTask | null }) {
  if (!task) return <span className="text-slate-400">—</span>
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={TASK_TONE[task.state] ?? 'slate'}>{task.state.replace('_', ' ')}</Badge>
        {task.type && <span className="text-xs text-slate-600">{task.type}</span>}
      </div>
      {task.error_message && <div className="text-xs text-red-700">{task.error_message}</div>}
      <div className="text-xs text-slate-400" title={formatDateTime(task.updated_at)}>
        {task.task_no && <span className="font-mono">{task.task_no}</span>} · {timeAgo(task.updated_at)}
      </div>
    </div>
  )
}
