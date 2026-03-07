import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSmoothStream } from './useSmoothStream'

describe('useSmoothStream', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb =>
      window.setTimeout(() => cb(performance.now()), 16),
    )
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      clearTimeout(id)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows full text immediately when not streaming', () => {
    const { result } = renderHook(() => useSmoothStream('hello world', false))
    expect(result.current.displayText).toBe('hello world')
    expect(result.current.isAnimating).toBe(false)
  })

  it('flushes remaining text when streaming ends', () => {
    const { result, rerender } = renderHook(
      ({ text, streaming }) => useSmoothStream(text, streaming, { charDelay: 20 }),
      { initialProps: { text: '', streaming: true } },
    )

    rerender({ text: 'hello', streaming: true })

    act(() => {
      vi.advanceTimersByTime(32)
    })

    rerender({ text: 'hello world', streaming: false })

    act(() => {
      vi.advanceTimersByTime(32)
    })

    expect(result.current.displayText).toBe('hello world')
    expect(result.current.isAnimating).toBe(false)
  })
})
