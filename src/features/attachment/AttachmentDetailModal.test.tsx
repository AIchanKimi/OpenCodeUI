import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AttachmentDetailModal } from './AttachmentDetailModal'
import type { Attachment } from './types'

describe('AttachmentDetailModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb =>
      window.setTimeout(() => cb(performance.now()), 0),
    )
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      clearTimeout(id)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('stays mounted during close transition for text attachments', () => {
    const attachment: Attachment = {
      id: 'attachment-1',
      type: 'file',
      displayName: 'notes.txt',
      mime: 'text/plain',
      content: 'hello world',
    }

    const { rerender } = render(<AttachmentDetailModal attachment={attachment} isOpen={true} onClose={vi.fn()} />)

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.getByText('notes.txt')).toBeInTheDocument()
    expect(screen.getByText('hello world')).toBeInTheDocument()

    rerender(<AttachmentDetailModal attachment={attachment} isOpen={false} onClose={vi.fn()} />)

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(screen.getByText('notes.txt')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
  })
})
