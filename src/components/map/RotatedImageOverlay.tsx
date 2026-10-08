import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

/**
 * An image placed on the map by three corners (so it can be rotated, scaled and skewed),
 * drawn with a CSS matrix in Leaflet's overlay pane. Not interactive.
 */
export function RotatedImageOverlay({
  url,
  width,
  height,
  topLeft,
  topRight,
  bottomLeft,
  opacity = 0.5,
}: {
  url: string
  /** Natural image size in pixels. */
  width: number
  height: number
  topLeft: L.LatLngExpression
  topRight: L.LatLngExpression
  bottomLeft: L.LatLngExpression
  opacity?: number
}) {
  const map = useMap()
  const imgRef = useRef<HTMLImageElement | null>(null)
  const opacityRef = useRef(opacity)
  opacityRef.current = opacity

  useEffect(() => {
    const img = L.DomUtil.create('img', 'leaflet-image-layer leaflet-zoom-hide') as HTMLImageElement
    img.src = url
    img.alt = ''
    Object.assign(img.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${width}px`,
      height: `${height}px`,
      transformOrigin: '0 0',
      pointerEvents: 'none',
      imageRendering: 'pixelated',
      opacity: String(opacityRef.current),
    })
    map.getPanes().overlayPane.appendChild(img)
    imgRef.current = img

    // Map image corners (0,0), (w,0), (0,h) onto the three layer points.
    const place = () => {
      const tl = map.latLngToLayerPoint(topLeft)
      const tr = map.latLngToLayerPoint(topRight)
      const bl = map.latLngToLayerPoint(bottomLeft)
      const a = (tr.x - tl.x) / width
      const b = (tr.y - tl.y) / width
      const c = (bl.x - tl.x) / height
      const d = (bl.y - tl.y) / height
      img.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${tl.x}, ${tl.y})`
    }
    place()
    map.on('zoomend viewreset', place)
    return () => {
      map.off('zoomend viewreset', place)
      img.remove()
      imgRef.current = null
    }
  }, [map, url, width, height, topLeft, topRight, bottomLeft])

  useEffect(() => {
    if (imgRef.current) imgRef.current.style.opacity = String(opacity)
  }, [opacity])

  return null
}
