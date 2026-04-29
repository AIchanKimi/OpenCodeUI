import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectDialog } from './ProjectDialog'
import { getPath, listDirectory } from '../../api'
import { notificationStore } from '../../store'

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

vi.mock('../../store', () => ({
  notificationStore: {
    push: vi.fn(),
  },
}))

describe('ProjectDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes from path api and loads directory entries', async () => {
    render(<ProjectDialog isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />)

    expect(await screen.findByDisplayValue('/workspace/project/')).toBeInTheDocument()
    expect(await screen.findByText('src')).toBeInTheDocument()
    expect(await screen.findByText('docs')).toBeInTheDocument()

    expect(screen.getByText('Add current')).toBeInTheDocument()
  })

  it('reloads the same directory when reopened', async () => {
    const { rerender } = render(<ProjectDialog key="first" isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />)

    expect(await screen.findByText('src')).toBeInTheDocument()

    rerender(<ProjectDialog key="closed" isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />)
    rerender(<ProjectDialog key="second" isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />)

    await waitFor(() => expect(vi.mocked(getPath).mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(vi.mocked(listDirectory).mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(await screen.findByText('src')).toBeInTheDocument()
  })

  it('does not allow adding unix root as a project', async () => {
    const onSelect = vi.fn()

    render(<ProjectDialog isOpen={true} onClose={vi.fn()} onSelect={onSelect} initialPath="/" />)

    expect(await screen.findByDisplayValue('/')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Add current'))

    expect(onSelect).not.toHaveBeenCalled()
    expect(notificationStore.push).toHaveBeenCalledWith(
      'error',
      'Add current',
      'Root directory is already available in Global mode',
      'project-dialog',
      undefined,
    )
  })

  it('does not allow adding windows root as a project', async () => {
    const onSelect = vi.fn()

    render(<ProjectDialog isOpen={true} onClose={vi.fn()} onSelect={onSelect} initialPath="C:/" />)

    expect(await screen.findByDisplayValue('C:/')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Add current'))

    expect(onSelect).not.toHaveBeenCalled()
    expect(notificationStore.push).toHaveBeenCalledWith(
      'error',
      'Add current',
      'Root directory is already available in Global mode',
      'project-dialog',
      undefined,
    )
  })
})
