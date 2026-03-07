import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectDialog } from './ProjectDialog'

vi.mock('../../components/ui/Dialog', () => ({
  Dialog: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}))

vi.mock('../../api', () => ({
  getPath: vi.fn().mockResolvedValue({ home: '/workspace/project' }),
  listDirectory: vi.fn().mockResolvedValue([
    { name: 'src', type: 'directory', absolute: '/workspace/project/src' },
    { name: 'docs', type: 'directory', absolute: '/workspace/project/docs' },
  ]),
}))

describe('ProjectDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('initializes from path api and loads directory entries', async () => {
    render(<ProjectDialog isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />)

    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByDisplayValue('/workspace/project/')).toBeInTheDocument()
    expect(screen.getByText('src')).toBeInTheDocument()
    expect(screen.getByText('docs')).toBeInTheDocument()
    expect(screen.getByText('Add current')).toBeInTheDocument()
  })
})
