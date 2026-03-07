import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders content and unmounts after close transition', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Dialog isOpen={true} onClose={onClose} title="Test Dialog">
        <div>dialog body</div>
      </Dialog>,
    )

    expect(screen.getByText('Test Dialog')).toBeInTheDocument()
    expect(screen.getByText('dialog body')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <Dialog isOpen={false} onClose={onClose} title="Test Dialog">
        <div>dialog body</div>
      </Dialog>,
    )

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(screen.getByText('dialog body')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('dialog body')).not.toBeInTheDocument()
  })
})
