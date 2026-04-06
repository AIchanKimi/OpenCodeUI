import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from 'react'

interface UseHorizontalSplitResizeOptions {
  containerRef: RefObject<HTMLElement | null>
  primaryRef: RefObject<HTMLElement | null>
  cssVariableName: `--${string}`
  minPrimaryWidth: number
  minSecondaryWidth: number
  defaultPrimaryWidthRatio?: number
}

interface UseHorizontalSplitResizeResult {
  splitWidth: number | null
  isResizing: boolean
  resetSplitWidth: () => void
  handleResizeStart: (event: ReactMouseEvent) => void
  handleTouchResizeStart: (event: ReactTouchEvent) => void
}

export function useHorizontalSplitResize({
  containerRef,
  primaryRef,
  cssVariableName,
  minPrimaryWidth,
  minSecondaryWidth,
  defaultPrimaryWidthRatio = 0.4,
}: UseHorizontalSplitResizeOptions): UseHorizontalSplitResizeResult {
  const [splitWidth, setSplitWidth] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const rafRef = useRef<number>(0)
  const currentWidthRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!isResizing && primaryRef.current && splitWidth !== null) {
      primaryRef.current.style.setProperty(cssVariableName, `${splitWidth}px`)
      currentWidthRef.current = splitWidth
    }
  }, [cssVariableName, isResizing, primaryRef, splitWidth])

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const resetSplitWidth = useCallback(() => {
    setSplitWidth(null)
    currentWidthRef.current = null
  }, [])

  const applyWidth = useCallback(
    (containerWidth: number, startWidth: number, startX: number, currentX: number) => {
      const primaryEl = primaryRef.current
      if (!primaryEl) return

      const deltaX = currentX - startX
      const nextWidth = startWidth + deltaX
      const maxWidth = containerWidth - minSecondaryWidth
      const clampedWidth = Math.min(Math.max(nextWidth, minPrimaryWidth), maxWidth)

      primaryEl.style.setProperty(cssVariableName, `${clampedWidth}px`)
      currentWidthRef.current = clampedWidth
    },
    [cssVariableName, minPrimaryWidth, minSecondaryWidth, primaryRef],
  )

  const finishResize = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    setIsResizing(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    if (currentWidthRef.current !== null) {
      setSplitWidth(currentWidthRef.current)
    }
  }, [])

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()

      const container = containerRef.current
      if (!container || !primaryRef.current) return

      setIsResizing(true)

      const containerRect = container.getBoundingClientRect()
      const primaryRect = primaryRef.current.getBoundingClientRect()
      const startX = event.clientX
      const startWidth = currentWidthRef.current ?? primaryRect.width ?? containerRect.width * defaultPrimaryWidthRatio

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
        }

        rafRef.current = requestAnimationFrame(() => {
          applyWidth(containerRect.width, startWidth, startX, moveEvent.clientX)
        })
      }

      const handleMouseUp = () => {
        finishResize()
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [applyWidth, containerRef, defaultPrimaryWidthRatio, finishResize, primaryRef],
  )

  const handleTouchResizeStart = useCallback(
    (event: ReactTouchEvent) => {
      const container = containerRef.current
      if (!container || !primaryRef.current) return

      setIsResizing(true)

      const containerRect = container.getBoundingClientRect()
      const primaryRect = primaryRef.current.getBoundingClientRect()
      const startX = event.touches[0].clientX
      const startWidth = currentWidthRef.current ?? primaryRect.width ?? containerRect.width * defaultPrimaryWidthRatio

      const handleTouchMove = (moveEvent: TouchEvent) => {
        moveEvent.preventDefault()
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
        }

        rafRef.current = requestAnimationFrame(() => {
          applyWidth(containerRect.width, startWidth, startX, moveEvent.touches[0].clientX)
        })
      }

      const handleTouchEnd = () => {
        finishResize()
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }

      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
    },
    [applyWidth, containerRef, defaultPrimaryWidthRatio, finishResize, primaryRef],
  )

  return {
    splitWidth,
    isResizing,
    resetSplitWidth,
    handleResizeStart,
    handleTouchResizeStart,
  }
}
