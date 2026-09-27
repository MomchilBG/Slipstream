import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

// Shared pointer-drag plumbing for AvatarCropper and ImageLightbox: tracks
// the last pointer position in a ref (not state, so dragging doesn't
// re-render beyond what the caller's own onDrag does), uses pointer
// capture so the drag keeps tracking even if the cursor leaves the
// element mid-move, and reports each move as the delta since the previous
// one - the caller folds that into its own offset state (and whatever
// clamping its own layout needs) via a functional update.
export const usePointerPan = (onDrag: (dx: number, dy: number) => void) => {
  const lastPosition = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    lastPosition.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!lastPosition.current) return
    const dx = event.clientX - lastPosition.current.x
    const dy = event.clientY - lastPosition.current.y
    lastPosition.current = { x: event.clientX, y: event.clientY }
    onDrag(dx, dy)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    lastPosition.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return { onPointerDown, onPointerMove, onPointerUp }
}
