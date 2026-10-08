import { Link } from 'react-router-dom'
import { Badge, Card, ErrorBox, Spinner, errorMessage } from '../../components/ui'
import { formatDateTime, timeAgo } from '../../lib/format'
import { useKeenonMapRobots } from './useKeenonMaps'

/** "Robot maps" section of the Keenon config page: each robot's scene and floor matching progress. */
export function KeenonRobotMapsCard() {
  const { data: robots, isPending, error } = useKeenonMapRobots()

  return (
    <Card
      title="Robot maps"
      description="The floors (maps) each robot knows in its Keenon scene, and which app floor plan each one matches. Open a robot to discover its floors and match them."
    >
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorBox>{errorMessage(error)}</ErrorBox>
      ) : robots.length === 0 ? (
        <p className="text-sm text-slate-500">No Keenon robots yet. Sync robots first.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Robot</th>
                <th className="px-3 py-2 font-medium">Store</th>
                <th className="px-3 py-2 font-medium">Scene</th>
                <th className="px-3 py-2 font-medium">Floors</th>
                <th className="px-3 py-2 font-medium">Discovered</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {robots.map((r) => (
                <tr key={r.robot_id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name ?? r.external_id}</div>
                    <div className="font-mono text-xs text-slate-500">{r.external_id}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.store_name ?? r.store_external_id ?? '—'}</td>
                  <td className="px-3 py-2">
                    {r.scene.code ? (
                      <>
                        <div>{r.scene.name ?? r.scene.code}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">{r.scene.code}</span> ·{' '}
                          {r.scene.source === 'manual' ? 'set manually' : 'auto-detected'}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">Not discovered</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.floors_found === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <Badge tone={r.floors_matched === r.floors_found ? 'green' : 'amber'}>
                        {r.floors_matched}/{r.floors_found} matched
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600" title={formatDateTime(r.discovered_at)}>
                    {timeAgo(r.discovered_at)}
                    {r.discovery_error && <div className="text-xs text-amber-700">with warnings</div>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/vendors/keenon/robots/${r.robot_id}`} className="text-sm text-blue-600 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
