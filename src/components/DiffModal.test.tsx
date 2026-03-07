import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiffModal } from './DiffModal'

vi.mock('./DiffViewer', () => ({
  DiffViewer: () => <div data-testid="diff-viewer">diff viewer</div>,
  extractContentFromUnifiedDiff: () => ({ before: 'before', after: 'after' }),
}))

describe('DiffModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      return window.setTimeout(() => cb(performance.now()), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      clearTimeout(id)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('stays mounted during close transition and then unmounts', () => {
    const { rerender } = render(
      <DiffModal
        isOpen={true}
        onClose={vi.fn()}
        diff={{ before: 'const a = 1', after: 'const a = 2' }}
        filePath="src/app.ts"
      />,
    )

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()

    rerender(
      <DiffModal
        isOpen={false}
        onClose={vi.fn()}
        diff={{ before: 'const a = 1', after: 'const a = 2' }}
        filePath="src/app.ts"
      />,
    )

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
