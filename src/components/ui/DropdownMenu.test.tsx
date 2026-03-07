import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { DropdownMenu } from './DropdownMenu'

function DropdownHarness({ isOpen }: { isOpen: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      <button ref={triggerRef} data-testid="trigger" onClick={() => {}}>
        trigger
      </button>
      <DropdownMenu triggerRef={triggerRef} isOpen={isOpen}>
        <div>dropdown content</div>
      </DropdownMenu>
    </div>
  )
}

describe('DropdownMenu', () => {
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

  it('stays mounted during close transition and then unmounts', () => {
    const { rerender } = render(<DropdownHarness isOpen={true} />)

    const trigger = screen.getByTestId('trigger')
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({ top: 100, bottom: 132, left: 50, right: 150, width: 100, height: 32 }),
    })

    act(() => {
      vi.advanceTimersByTime(48)
    })

    expect(screen.getByText('dropdown content')).toBeInTheDocument()

    rerender(<DropdownHarness isOpen={false} />)

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(screen.getByText('dropdown content')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(17)
    })
    expect(screen.queryByText('dropdown content')).not.toBeInTheDocument()
  })
})
