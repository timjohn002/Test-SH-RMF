import { CircleMarker, Tooltip } from 'react-leaflet'
import { pixelToLatLng } from '../../lib/coords'
import { timeAgo } from '../../lib/format'
import type { MapRobot } from '../../types/api'

const BLUE = '#2563eb'

export function robotLabel(robot: { name: string | null; model?: string | null }): string {
  return robot.name ?? robot.model ?? 'Robot'
}

/** Robots as blue dots on a floor plan; stale ones faded. Names always shown, or on hover only. */
export function RobotDots({ robots, showNames }: { robots: MapRobot[]; showNames: boolean }) {
  return (
    <>
      {robots.map((robot) => (
        <CircleMarker
          // Leaflet can't switch a tooltip between permanent and hover: remount on toggle.
          key={`${robot.id}-${showNames ? 'names' : 'hover'}`}
          center={pixelToLatLng({ x: robot.x_px, y: robot.y_px })}
          radius={7}
          pathOptions={
            robot.stale
              ? { color: BLUE, weight: 2, opacity: 0.5, dashArray: '3 3', fillColor: BLUE, fillOpacity: 0.3 }
              : { color: '#ffffff', weight: 2, fillColor: BLUE, fillOpacity: 1 }
          }
        >
          <Tooltip
            permanent={showNames}
            direction="right"
            offset={[8, 0]}
            opacity={robot.stale ? 0.55 : 0.9}
          >
            {robotLabel(robot)}
            {robot.stale && <span className="text-slate-500"> · {timeAgo(robot.position_at)}</span>}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  )
}
