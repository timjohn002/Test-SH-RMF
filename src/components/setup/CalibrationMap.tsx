import { useState } from 'react'
import { CircleMarker, Polyline } from 'react-leaflet'
import {
  formatMeters,
  niceLength,
  pixelToLatLng,
  scaleFromTwoPoints,
  worldToPixel,
  type PlanCalibration,
  type Point,
} from '../../lib/coords'
import type { Floor } from '../../types/api'
import { PlanMap } from '../map/PlanMap'
import { Button, ErrorBox, cx, errorMessage } from '../ui'

type Tool = 'pan' | 'scale' | 'origin'

const TOOL_HELP: Record<Tool, string> = {
  pan: 'Drag to move, scroll or pinch to zoom.',
  scale: 'Click two points whose real distance you know (e.g. the ends of a wall), then enter that distance.',
  origin: 'Click the point that should be world (0, 0), e.g. the robot map origin or a building corner.',
}

export function CalibrationMap({
  floor,
  calibration,
  onScale,
  onOrigin,
}: {
  floor: Floor
  calibration: PlanCalibration
  onScale: (scaleMPerPx: number) => void
  onOrigin: (p: Point) => void
}) {
  const [tool, setTool] = useState<Tool>('pan')
  const [points, setPoints] = useState<Point[]>([])
  const [distance, setDistance] = useState('')
  const [error, setError] = useState<string | null>(null)

  function selectTool(next: Tool) {
    setTool(next)
    setPoints([])
    setError(null)
  }

  function onPlanClick(p: Point) {
    if (tool === 'origin') {
      onOrigin(p)
      setTool('pan')
    } else if (tool === 'scale') {
      setPoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]))
    }
  }

  function applyScale() {
    try {
      onScale(scaleFromTwoPoints(points[0], points[1], Number(distance)))
      setDistance('')
      selectTool('pan')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const axisMeters = niceLength(calibration.scale_m_per_px)
  const origin = { x: calibration.origin_x_px, y: calibration.origin_y_px }
  const xEnd = worldToPixel({ x: axisMeters, y: 0 }, calibration)
  const yEnd = worldToPixel({ x: 0, y: axisMeters }, calibration)
  const measuredPx = points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
          {(
            [
              ['pan', 'Pan'],
              ['scale', 'Measure scale'],
              ['origin', 'Set origin'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => selectTool(value)}
              className={cx(
                'rounded px-3 py-1 text-sm font-medium',
                tool === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500">{TOOL_HELP[tool]}</p>
      </div>

      <div className="h-[480px] overflow-hidden rounded-lg border border-slate-200">
        <PlanMap
          mapKey={floor.id}
          planUrl={floor.plan_url!}
          widthPx={floor.plan_width_px!}
          heightPx={floor.plan_height_px!}
          calibration={calibration}
          onPlanClick={tool === 'pan' ? undefined : onPlanClick}
          showPixels
        >
          <Polyline
            interactive={false}
            positions={[pixelToLatLng(origin), pixelToLatLng(xEnd)]}
            pathOptions={{ color: '#dc2626', weight: 3 }}
          />
          <Polyline
            interactive={false}
            positions={[pixelToLatLng(origin), pixelToLatLng(yEnd)]}
            pathOptions={{ color: '#16a34a', weight: 3 }}
          />
          <CircleMarker
            interactive={false}
            center={pixelToLatLng(origin)}
            radius={5}
            pathOptions={{ color: '#0f172a', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
          />

          {points.length === 2 && (
            <Polyline
              interactive={false}
              positions={points.map(pixelToLatLng)}
              pathOptions={{ color: '#2563eb', weight: 2, dashArray: '6 4' }}
            />
          )}
          {points.map((p, i) => (
            <CircleMarker
              key={i}
              interactive={false}
              center={pixelToLatLng(p)}
              radius={5}
              pathOptions={{ color: '#2563eb', weight: 2, fillColor: '#93c5fd', fillOpacity: 1 }}
            />
          ))}
        </PlanMap>
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-red-600">Red</span> = +X axis,{' '}
        <span className="font-medium text-green-600">green</span> = +Y axis, each {formatMeters(axisMeters)} long from
        the origin. Check they match a known distance on the plan.
      </p>

      {tool === 'scale' && points.length === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applyScale()
          }}
          className="flex flex-wrap items-end gap-2 rounded-md bg-blue-50 p-3"
        >
          <p className="w-full text-sm text-slate-700">Measured {measuredPx.toFixed(1)} px between the two points.</p>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Real distance (m)</span>
            <input
              type="number"
              step="any"
              min="0"
              autoFocus
              required
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-36 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <Button type="submit" size="sm">
            Apply scale
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPoints([])}>
            Re-measure
          </Button>
          {error && (
            <div className="w-full">
              <ErrorBox>{error}</ErrorBox>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
