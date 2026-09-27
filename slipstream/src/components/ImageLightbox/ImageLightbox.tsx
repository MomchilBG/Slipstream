import { useEffect, useRef, useState } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { usePointerPan } from '../../lib/usePointerPan'
import './ImageLightbox.css'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

export interface ImageLightboxProps {
  src: string
  onClose: () => void
}

// A full-screen viewer for a post's images - separate from AvatarCropper
// (which crops to a fixed output) since this only ever displays: no
// output size, no cover-fit-then-pan-inward math, just "contain"-fit at
// 1x with room to zoom in past that.
const ImageLightbox = ({ src, onClose }: ImageLightboxProps) => {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Pan is bounded by how far the zoomed image extends past its
  // (unscaled) contain-fit box on each axis - zero once zoom is back to
  // 1, since the image then fits inside the viewport with nothing to pan.
  const clampOffset = (x: number, y: number, nextZoom: number) => {
    if (!fitSize) return { x: 0, y: 0 }
    const maxX = Math.max(0, (fitSize.width * nextZoom - fitSize.width) / 2)
    const maxY = Math.max(0, (fitSize.height * nextZoom - fitSize.height) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }

  const applyZoom = (nextZoom: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    setZoom(clamped)
    setOffset((current) => clampOffset(current.x, current.y, clamped))
  }

  const handleImageLoad = () => {
    const img = imgRef.current
    if (!img) return
    setFitSize({ width: img.offsetWidth, height: img.offsetHeight })
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    applyZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
  }

  const handleDoubleClick = () => {
    applyZoom(zoom > MIN_ZOOM ? MIN_ZOOM : 2)
  }

  // Below MIN_ZOOM there's nowhere to pan to (clampOffset always returns
  // {0, 0}), so skip the setOffset call entirely rather than re-rendering
  // on every pointermove for a drag that can't actually move anything.
  const { onPointerDown, onPointerMove, onPointerUp } = usePointerPan((dx, dy) => {
    if (zoom <= MIN_ZOOM) return
    setOffset((current) => clampOffset(current.x + dx, current.y + dy, zoom))
  })

  return (
    <div className="lightbox-overlay" onClick={onClose} onWheel={handleWheel}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      </button>

      <div className="lightbox-zoom-controls" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => applyZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => applyZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
          +
        </button>
      </div>

      <img
        ref={imgRef}
        src={src}
        alt=""
        draggable={false}
        onLoad={handleImageLoad}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={handleDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          cursor: zoom > MIN_ZOOM ? 'grab' : 'zoom-in',
        }}
      />
    </div>
  )
}

export default ImageLightbox
