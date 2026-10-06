import L from 'leaflet'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ImageOverlay, MapContainer, useMap, useMapEvents } from 'react-leaflet'
import { formatMeters, latLngToPixel, planBounds, pixelToWorld, type PlanCalibration, type Point } from '../../lib/coords'
import { cx } from '../ui'

interface PlanMapProps {
  /** Remount the map when this changes (e.g. a different floor). */
  mapKey: string
  planUrl: string
  widthPx: number
  heightPx: number
  calibration: PlanCalibration
  /** When set, clicks on the plan are reported in pixel coordinates and the cursor becomes a crosshair. */
  onPlanClick?: (p: Point) => void
  /** Show pixel coordinates next to world coordinates in the cursor readout. */
  showPixels?: boolean
  children?: ReactNode
}

/**
 * Floor plan viewer: the plan image on a Leaflet CRS.Simple map with drag,
 * wheel/pinch zoom, +/- buttons, fit-to-plan and a cursor position readout.
 */
export function PlanMap({
  mapKey,
  planUrl,
  widthPx,
  heightPx,
  calibration,
  onPlanClick,
  showPixels,
  children,
}: PlanMapProps) {
  const bounds = useMemo(() => L.latLngBounds(planBounds(widthPx, heightPx)), [widthPx, heightPx])
  const [map, setMap] = useState<L.Map | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)

  const world = cursor && pixelToWorld(cursor, calibration)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        key={`${mapKey}:${widthPx}x${heightPx}`}
        ref={setMap}
        crs={L.CRS.Simple}
        bounds={bounds}
        minZoom={-8}
        maxZoom={4}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={120}
        maxBounds={bounds.pad(0.5)}
        maxBoundsViscosity={1}
        attributionControl={false}
        className={cx('h-full w-full', onPlanClick && 'plan-pick')}
      >
        <ImageOverlay url={planUrl} bounds={bounds} />
        <MapBehavior bounds={bounds} onCursor={setCursor} onPlanClick={onPlanClick} />
        {children}
      </MapContainer>

      <button
        type="button"
        title="Fit plan to screen"
        onClick={() => map?.fitBounds(bounds)}
        className="absolute right-2.5 top-2.5 z-[1000] rounded-md border-2 border-black/20 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Fit
      </button>

      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded bg-white/90 px-2 py-1 font-mono text-xs text-slate-700 shadow">
        {world && cursor ? (
          <>
            x {formatMeters(world.x)} · y {formatMeters(world.y)}
            {showPixels && (
              <span className="text-slate-400">
                {' '}
                ({Math.round(cursor.x)}, {Math.round(cursor.y)} px)
              </span>
            )}
          </>
        ) : (
          'Hover over the plan for coordinates'
        )}
      </div>
    </div>
  )
}

function MapBehavior({
  bounds,
  onCursor,
  onPlanClick,
}: {
  bounds: L.LatLngBounds
  onCursor: (p: Point | null) => void
  onPlanClick?: (p: Point) => void
}) {
  const map = useMap()

  // Allow zooming out slightly past "whole plan visible", and keep the map sized to its container.
  useEffect(() => {
    const updateMinZoom = () => map.setMinZoom(Math.floor(map.getBoundsZoom(bounds)) - 1)
    updateMinZoom()
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
      updateMinZoom()
    })
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map, bounds])

  useMapEvents({
    mousemove: (e) => onCursor(latLngToPixel(e.latlng.lat, e.latlng.lng)),
    mouseout: () => onCursor(null),
    click: (e) => onPlanClick?.(latLngToPixel(e.latlng.lat, e.latlng.lng)),
  })
  return null
}
