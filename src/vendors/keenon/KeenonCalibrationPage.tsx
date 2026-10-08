import { useMemo, useState } from 'react'
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PlanMap } from '../../components/map/PlanMap'
import { RotatedImageOverlay } from '../../components/map/RotatedImageOverlay'
import { Badge, Button, Card, ErrorBox, FullPageSpinner, cx, errorMessage, type BadgeTone } from '../../components/ui'
import { useFloors } from '../../hooks/useFloors'
import { formatMeters, pixelToLatLng, pixelToWorld, worldToPixel, type Point } from '../../lib/coords'
import { formatDateTime } from '../../lib/format'
import type { Floor, RobotPosition } from '../../types/api'
import {
  fitTransform,
  headingOnPlan,
  pairErrors,
  robotToPlan,
  scaleDeviation,
  type CalibrationPair,
  type PlanTransform,
} from './calibration'
import { keenonMapCalibration, mapPixelToMeters } from './mapGeometry'
import type { KeenonRobotFloor, KeenonRobotMapsDetail } from './shared'
import { useClearCalibration, useKeenonRobotMaps, useLocateRobot, useSaveCalibration } from './useKeenonMaps'

/** Snap a Keenon-map click to a named point within this many image pixels. */
const SNAP_PX = 10
const SCALE_WARNING = 0.05

const PAIR_COLOR = '#ea580c'

function errorTone(m: number): BadgeTone {
  return m < 0.3 ? 'green' : m <= 1 ? 'amber' : 'red'
}

/** `/vendors/keenon/robots/:robotId/floors/:floorId/calibrate` */
export function KeenonCalibrationPage() {
  const { robotId = '', floorId = '' } = useParams()
  const detail = useKeenonRobotMaps(robotId)
  const appFloors = useFloors()
  const back = `/vendors/keenon/robots/${robotId}`

  if (detail.isPending || appFloors.isPending) return <FullPageSpinner />
  const error = detail.error ?? appFloors.error
  const floor = detail.data?.floors.find((f) => f.id === floorId)
  const appFloor = appFloors.data?.find((f) => f.id === floor?.app_floor_id)

  let problem: string | null = null
  if (error) problem = errorMessage(error)
  else if (!floor) problem = 'This Keenon floor was not found.'
  else if (!floor.app_floor_id || !appFloor) problem = 'Match this floor to an app floor before calibrating.'
  else if (!floor.map_png || !floor.map_width || !floor.map_height || floor.origin_x_m === null || floor.origin_y_m === null)
    problem = 'Keenon returned no map image for this floor, so it cannot be calibrated.'
  else if (!appFloor.plan_url || !appFloor.plan_width_px || !appFloor.plan_height_px)
    problem = `“${appFloor.name}” has no floor plan yet. Upload one in Setup.`

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 sm:p-6">
        <Link to={back} className="text-sm text-blue-600 hover:underline">
          ← {detail.data?.robot.name ?? 'Robot'} maps
        </Link>
        {problem || !floor || !appFloor || !detail.data ? (
          <ErrorBox>{problem}</ErrorBox>
        ) : (
          <CalibrationEditor key={floor.id} floor={floor} appFloor={appFloor} detail={detail.data} backTo={back} />
        )}
      </div>
    </div>
  )
}

function savedTransform(floor: KeenonRobotFloor): PlanTransform | null {
  const { calib_scale_px_per_m: scale, calib_rotation_rad: rotation, calib_origin_x_px: ox, calib_origin_y_px: oy } = floor
  return scale !== null && rotation !== null && ox !== null && oy !== null
    ? { scale, rotation, origin_x: ox, origin_y: oy }
    : null
}

function CalibrationEditor({
  floor,
  appFloor,
  detail,
  backTo,
}: {
  floor: KeenonRobotFloor
  appFloor: Floor
  detail: KeenonRobotMapsDetail
  backTo: string
}) {
  const navigate = useNavigate()
  const robotId = detail.robot.robot_id
  const save = useSaveCalibration(robotId)
  const clear = useClearCalibration(robotId)
  const locate = useLocateRobot(robotId)

  const [pairs, setPairs] = useState<CalibrationPair[]>(floor.calib_pairs ?? [])
  // Hand-tuned transform; null = use the fit. Starts as the saved one (which may be hand-tuned).
  const [manual, setManual] = useState<PlanTransform | null>(savedTransform(floor))
  const [pendingRobot, setPendingRobot] = useState<{ point: Point; name: string | null } | null>(null)
  const [pendingPlan, setPendingPlan] = useState<Point | null>(null)
  const [overlay, setOverlay] = useState(true)
  const [opacity, setOpacity] = useState(0.5)
  const [saved, setSaved] = useState(false)

  const keenonFrame = { map_height: floor.map_height!, origin_x_m: floor.origin_x_m!, origin_y_m: floor.origin_y_m! }
  const keenonCal = useMemo(() => keenonMapCalibration(keenonFrame), [floor.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fit = useMemo(() => {
    if (pairs.length < 2) return null
    try {
      return { result: fitTransform(pairs), error: null }
    } catch (err) {
      return { result: null, error: errorMessage(err) }
    }
  }, [pairs])

  const transform = manual ?? fit?.result?.transform ?? null
  const quality = transform && pairs.length >= 2 ? pairErrors(transform, pairs) : null
  const deviation = transform ? scaleDeviation(transform, appFloor.scale_m_per_px) : null
  const robotPos =
    detail.position && floor.scene_code === detail.robot.scene.code && detail.position.floor === String(floor.floor)
      ? detail.position
      : null

  function updatePairs(next: CalibrationPair[]) {
    setPairs(next)
    setManual(null) // the fit takes over again
    setSaved(false)
  }

  function addPair(robot: { point: Point; name: string | null }, plan: Point) {
    updatePairs([...pairs, { robot: robot.point, plan, point_name: robot.name }])
    setPendingRobot(null)
    setPendingPlan(null)
  }

  function onKeenonClick(imagePx: Point) {
    // Snap to the nearest named point, if close enough.
    let best: { point: Point; name: string | null } = { point: pixelToWorld(imagePx, keenonCal), name: null }
    let bestDist = SNAP_PX
    for (const p of floor.points) {
      const metres = mapPixelToMeters(keenonFrame, { x: p.x_px, y: p.y_px })
      const img = worldToPixel(metres, keenonCal)
      const d = Math.hypot(img.x - imagePx.x, img.y - imagePx.y)
      if (d < bestDist) {
        bestDist = d
        best = { point: metres, name: p.name }
      }
    }
    if (pendingPlan) addPair(best, pendingPlan)
    else setPendingRobot(best)
  }

  function onPlanClick(planPx: Point) {
    if (pendingRobot) addPair(pendingRobot, planPx)
    else setPendingPlan(planPx)
  }

  function nudge(change: Partial<PlanTransform> | ((t: PlanTransform) => Partial<PlanTransform>)) {
    if (!transform) return
    const delta = typeof change === 'function' ? change(transform) : change
    setManual({ ...transform, ...delta })
    setSaved(false)
  }

  function onSave() {
    if (!transform) return
    save.mutate(
      { floorId: floor.id, calibration: { ...transform, pairs } },
      { onSuccess: () => setSaved(true) },
    )
  }

  const step = pendingRobot
    ? 'Now click the same spot on your floor plan (right).'
    : pendingPlan
      ? 'Now click the same spot on the Keenon map (left).'
      : pairs.length < 2
        ? `Click a spot on the Keenon map (left), then the same spot on your floor plan (right). ${2 - pairs.length} more pair${pairs.length === 1 ? '' : 's'} needed.`
        : 'Add more pairs spread across the floor to improve accuracy (3–4 recommended), or check the overlay.'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            Calibrate {detail.robot.name ?? detail.robot.external_id} · Keenon floor {floor.floor}
            {floor.floor_label ? ` (${floor.floor_label})` : ''} → {appFloor.name}
          </h1>
          <p className="text-sm text-slate-500">
            Pair the same physical spots on both maps. Clicking near a Keenon named point snaps to it.
            {floor.calibrated_at && ` Last saved ${formatDateTime(floor.calibrated_at)}.`}
          </p>
        </div>
        {floor.calibration_stale && <Badge tone="amber">Keenon's map changed since the saved calibration</Badge>}
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        <strong>Step:</strong> {step}
        {(pendingRobot || pendingPlan) && (
          <button
            type="button"
            className="ml-3 text-xs underline"
            onClick={() => {
              setPendingRobot(null)
              setPendingPlan(null)
            }}
          >
            Cancel this pair
          </button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Keenon map (robot metres)</p>
          <div className="h-[60vh] min-h-80 overflow-hidden rounded-md border border-slate-200">
            <PlanMap
              mapKey={`calib-keenon-${floor.id}`}
              planUrl={`data:image/png;base64,${floor.map_png}`}
              widthPx={floor.map_width!}
              heightPx={floor.map_height!}
              calibration={keenonCal}
              onPlanClick={onKeenonClick}
            >
              {floor.points.map((p, i) => (
                <CircleMarker
                  key={`np-${i}`}
                  center={pixelToLatLng(worldToPixel(mapPixelToMeters(keenonFrame, { x: p.x_px, y: p.y_px }), keenonCal))}
                  radius={4}
                  interactive={false}
                  pathOptions={{ color: '#1d4ed8', weight: 1.5, fillColor: '#60a5fa', fillOpacity: 0.9 }}
                >
                  <Tooltip direction="top" offset={[0, -4]} permanent className="!text-[10px] !px-1 !py-0">
                    {p.name}
                  </Tooltip>
                </CircleMarker>
              ))}
              {pairs.map((pair, i) => (
                <PairMarker key={`kp-${i}`} at={pixelToLatLng(worldToPixel(pair.robot, keenonCal))} n={i + 1} />
              ))}
              {pendingRobot && <PendingMarker at={pixelToLatLng(worldToPixel(pendingRobot.point, keenonCal))} />}
              {robotPos && <RobotMarker at={pixelToLatLng(worldToPixel(robotPos, keenonCal))} />}
            </PlanMap>
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-slate-700">Your floor plan: {appFloor.name}</span>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={overlay} disabled={!transform} onChange={(e) => setOverlay(e.target.checked)} />
              Overlay Keenon map
            </label>
            {overlay && transform && (
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                aria-label="Overlay opacity"
              />
            )}
          </div>
          <div className="h-[60vh] min-h-80 overflow-hidden rounded-md border border-slate-200">
            <PlanMap
              mapKey={`calib-app-${floor.id}-${appFloor.id}`}
              planUrl={appFloor.plan_url!}
              widthPx={appFloor.plan_width_px!}
              heightPx={appFloor.plan_height_px!}
              calibration={appFloor}
              onPlanClick={onPlanClick}
            >
              {overlay && transform && <KeenonOverlay floor={floor} transform={transform} opacity={opacity} />}
              {transform &&
                floor.points.map((p, i) => (
                  <CircleMarker
                    key={`pp-${i}`}
                    center={pixelToLatLng(robotToPlan(transform, mapPixelToMeters(keenonFrame, { x: p.x_px, y: p.y_px })))}
                    radius={3}
                    interactive={false}
                    pathOptions={{ color: '#1d4ed8', weight: 1, fillColor: '#60a5fa', fillOpacity: 0.8 }}
                  />
                ))}
              {pairs.map((pair, i) => (
                <PairOnPlan key={`ap-${i}`} pair={pair} n={i + 1} transform={transform} />
              ))}
              {pendingPlan && <PendingMarker at={pixelToLatLng(pendingPlan)} />}
              {robotPos && transform && <RobotOnPlan position={robotPos} transform={transform} />}
            </PlanMap>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Point pairs" description="Distinctive spots: door frames, wall corners, charging piles. Spread them out.">
          {pairs.length === 0 ? (
            <p className="text-sm text-slate-500">No pairs yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">Robot point</th>
                  <th className="py-1 pr-2 font-medium">Plan pixel</th>
                  <th className="py-1 pr-2 font-medium">Error</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pairs.map((pair, i) => {
                  const err = quality?.errors[i]
                  return (
                    <tr key={i} className={cx(err?.outlier && 'bg-red-50')}>
                      <td className="py-1.5 pr-2 font-medium" style={{ color: PAIR_COLOR }}>
                        {i + 1}
                      </td>
                      <td className="py-1.5 pr-2">
                        {pair.point_name && <div>{pair.point_name}</div>}
                        <div className="text-xs tabular-nums text-slate-500">
                          {formatMeters(pair.robot.x)}, {formatMeters(pair.robot.y)}
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 text-xs tabular-nums text-slate-600">
                        {Math.round(pair.plan.x)}, {Math.round(pair.plan.y)}
                      </td>
                      <td className="py-1.5 pr-2">
                        {err && pairs.length >= 3 ? (
                          <Badge tone={errorTone(err.error_m)}>{formatMeters(err.error_m)}</Badge>
                        ) : (
                          <span className="text-xs text-slate-400">{pairs.length < 3 ? 'exact with 2' : '—'}</span>
                        )}
                        {err?.outlier && <div className="text-xs text-red-700">Probably misplaced</div>}
                      </td>
                      <td className="py-1.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => updatePairs(pairs.filter((_, j) => j !== i))}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {fit?.error && (
            <div className="mt-3">
              <ErrorBox>{fit.error}</ErrorBox>
            </div>
          )}
        </Card>

        <Card title="Transform" description="Computed from the pairs; fine-tune if the overlay is slightly off.">
          {!transform ? (
            <p className="text-sm text-slate-500">Add at least 2 pairs.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {quality && pairs.length >= 3 && (
                  <Badge tone={errorTone(quality.rms_m)}>Average error {formatMeters(quality.rms_m)}</Badge>
                )}
                {manual && <Badge tone="purple">Hand-tuned</Badge>}
                {deviation !== null && Math.abs(deviation) > SCALE_WARNING && (
                  <Badge tone="amber">
                    Scale is {Math.round(deviation * 100)}% off your floor plan's metres: check the pairs or the floor's
                    calibration
                  </Badge>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-slate-500">Rotation</dt>
                <dd className="tabular-nums">{((transform.rotation * 180) / Math.PI).toFixed(2)}°</dd>
                <dt className="text-slate-500">Scale</dt>
                <dd className="tabular-nums">
                  1 robot m = {transform.scale.toFixed(2)} plan px
                  {deviation !== null && ` (${deviation >= 0 ? '+' : ''}${(deviation * 100).toFixed(1)}%)`}
                </dd>
                <dt className="text-slate-500">Robot origin on plan</dt>
                <dd className="tabular-nums">
                  {transform.origin_x.toFixed(1)}, {transform.origin_y.toFixed(1)} px
                </dd>
              </dl>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">Nudge:</span>
                <NudgeButton label="⟲ 0.5°" onClick={() => nudge((t) => ({ rotation: t.rotation + Math.PI / 360 }))} />
                <NudgeButton label="⟳ 0.5°" onClick={() => nudge((t) => ({ rotation: t.rotation - Math.PI / 360 }))} />
                <NudgeButton label="← 1px" onClick={() => nudge((t) => ({ origin_x: t.origin_x - 1 }))} />
                <NudgeButton label="→ 1px" onClick={() => nudge((t) => ({ origin_x: t.origin_x + 1 }))} />
                <NudgeButton label="↑ 1px" onClick={() => nudge((t) => ({ origin_y: t.origin_y - 1 }))} />
                <NudgeButton label="↓ 1px" onClick={() => nudge((t) => ({ origin_y: t.origin_y + 1 }))} />
                <NudgeButton label="− 0.5%" onClick={() => nudge((t) => ({ scale: t.scale * 0.995 }))} />
                <NudgeButton label="+ 0.5%" onClick={() => nudge((t) => ({ scale: t.scale * 1.005 }))} />
                {manual && fit?.result && (
                  <NudgeButton label="Use computed" onClick={() => setManual(null)} />
                )}
              </div>
              <p className="text-xs text-slate-500">
                Nudges rotate around the robot map's origin. Changing the pairs replaces hand-tuning with a new fit.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card title="Check with the robot" description="Optional: confirm the robot appears where it physically is.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button variant="secondary" disabled={locate.isPending} onClick={() => locate.mutate()}>
            {locate.isPending ? 'Locating…' : 'Locate robot'}
          </Button>
          {robotPos ? (
            <span className="text-slate-600">
              Robot at {formatMeters(robotPos.x)}, {formatMeters(robotPos.y)} (red dot), reported{' '}
              {formatDateTime(robotPos.reported_at)}.
            </span>
          ) : (
            <span className="text-slate-500">The robot's last position isn't on this Keenon floor.</span>
          )}
        </div>
        {locate.error && (
          <div className="mt-2">
            <ErrorBox>{errorMessage(locate.error)}</ErrorBox>
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/95 py-3 backdrop-blur">
        <Button disabled={!transform || pairs.length < 2 || !!fit?.error || save.isPending} onClick={onSave}>
          {save.isPending ? 'Saving…' : 'Save calibration'}
        </Button>
        <Button variant="secondary" onClick={() => navigate(backTo)}>
          Back
        </Button>
        {saved && !save.isPending && <span className="text-sm text-green-700">Saved</span>}
        {save.error && <span className="text-sm text-red-700">{errorMessage(save.error)}</span>}
        {floor.calibrated_at && (
          <Button
            variant="ghost"
            className="ml-auto text-red-600 hover:bg-red-50"
            disabled={clear.isPending}
            onClick={() => {
              if (confirm('Remove the saved calibration for this floor?')) {
                clear.mutate(floor.id, {
                  onSuccess: () => {
                    setPairs([])
                    setManual(null)
                  },
                })
              }
            }}
          >
            Remove calibration
          </Button>
        )}
      </div>
    </div>
  )
}

function NudgeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick} className="tabular-nums">
      {label}
    </Button>
  )
}

function PairMarker({ at, n }: { at: [number, number]; n: number }) {
  return (
    <CircleMarker
      center={at}
      radius={7}
      interactive={false}
      pathOptions={{ color: '#7c2d12', weight: 2, fillColor: PAIR_COLOR, fillOpacity: 1 }}
    >
      <Tooltip direction="right" offset={[6, 0]} permanent>
        {n}
      </Tooltip>
    </CircleMarker>
  )
}

function PendingMarker({ at }: { at: [number, number] }) {
  return (
    <CircleMarker
      center={at}
      radius={7}
      interactive={false}
      pathOptions={{ color: PAIR_COLOR, weight: 2, dashArray: '3 3', fillOpacity: 0 }}
    />
  )
}

/** The clicked plan spot, plus (with a transform) where the robot point lands and the gap between them. */
function PairOnPlan({ pair, n, transform }: { pair: CalibrationPair; n: number; transform: PlanTransform | null }) {
  const predicted = transform ? robotToPlan(transform, pair.robot) : null
  return (
    <>
      {predicted && (
        <>
          <Polyline
            positions={[pixelToLatLng(pair.plan), pixelToLatLng(predicted)]}
            interactive={false}
            pathOptions={{ color: '#dc2626', weight: 2 }}
          />
          <CircleMarker
            center={pixelToLatLng(predicted)}
            radius={3}
            interactive={false}
            pathOptions={{ color: '#dc2626', weight: 1, fillColor: '#fff', fillOpacity: 1 }}
          />
        </>
      )}
      <PairMarker at={pixelToLatLng(pair.plan)} n={n} />
    </>
  )
}

function RobotMarker({ at }: { at: [number, number] }) {
  return (
    <CircleMarker
      center={at}
      radius={6}
      interactive={false}
      pathOptions={{ color: '#991b1b', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }}
    >
      <Tooltip direction="top" offset={[0, -6]} permanent>
        Robot
      </Tooltip>
    </CircleMarker>
  )
}

function RobotOnPlan({ position, transform }: { position: RobotPosition; transform: PlanTransform }) {
  const at = robotToPlan(transform, position)
  const arrow =
    position.heading_rad !== null
      ? (() => {
          const h = headingOnPlan(transform, position.heading_rad)
          // 0.6 robot metres long, in plan pixels (y down).
          const len = 0.6 * transform.scale
          return { x: at.x + len * Math.cos(h), y: at.y - len * Math.sin(h) }
        })()
      : null
  return (
    <>
      {arrow && (
        <Polyline
          positions={[pixelToLatLng(at), pixelToLatLng(arrow)]}
          interactive={false}
          pathOptions={{ color: '#991b1b', weight: 3 }}
        />
      )}
      <RobotMarker at={pixelToLatLng(at)} />
    </>
  )
}

/** Keenon's map image drawn on the app plan through the transform. */
function KeenonOverlay({ floor, transform, opacity }: { floor: KeenonRobotFloor; transform: PlanTransform; opacity: number }) {
  const corners = useMemo(() => {
    const frame = { map_height: floor.map_height!, origin_x_m: floor.origin_x_m!, origin_y_m: floor.origin_y_m! }
    const cal = keenonMapCalibration(frame)
    // Keenon image pixel → robot metres → plan pixel → map lat/lng.
    const corner = (x: number, y: number) => pixelToLatLng(robotToPlan(transform, pixelToWorld({ x, y }, cal)))
    return {
      topLeft: corner(0, 0),
      topRight: corner(floor.map_width!, 0),
      bottomLeft: corner(0, floor.map_height!),
    }
  }, [floor, transform])

  return (
    <RotatedImageOverlay
      url={`data:image/png;base64,${floor.map_png}`}
      width={floor.map_width!}
      height={floor.map_height!}
      opacity={opacity}
      {...corners}
    />
  )
}
