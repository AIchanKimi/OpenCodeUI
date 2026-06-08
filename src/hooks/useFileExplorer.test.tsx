import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileExplorer } from './useFileExplorer'
import { changeScopeStore } from '../store/changeScopeStore'

const {
  listDirectory,
  getFileContent,
  getFileServiceAvailability,
  getFileStatus,
  getSessionDiff,
  getLastTurnDiff,
  getVcsDiff,
  t,
} = vi.hoisted(() => ({
  listDirectory: vi.fn(),
  getFileContent: vi.fn(),
  getFileServiceAvailability: vi.fn(),
  getFileStatus: vi.fn(),
  getSessionDiff: vi.fn(),
  getLastTurnDiff: vi.fn(),
  getVcsDiff: vi.fn(),
  t: (key: string) => key,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
  }),
}))

vi.mock('../api', () => ({
  listDirectory,
  getFileContent,
  getFileServiceAvailability,
  getFileStatus,
  getSessionDiff,
  getLastTurnDiff,
  getVcsDiff,
}))

describe('useFileExplorer', () => {
  beforeEach(() => {
    changeScopeStore.clearAll()
    vi.clearAllMocks()

    listDirectory.mockResolvedValue([
      { name: 'src', path: 'src', absolute: '/repo/src', type: 'directory', ignored: false },
      { name: 'session.ts', path: 'src/session.ts', absolute: '/repo/src/session.ts', type: 'file', ignored: false },
      { name: 'turn.ts', path: 'src/turn.ts', absolute: '/repo/src/turn.ts', type: 'file', ignored: false },
    ])
    getFileContent.mockResolvedValue({ type: 'text', content: 'test' })
    getFileServiceAvailability.mockResolvedValue(true)
    getFileStatus.mockResolvedValue([])
    getVcsDiff.mockResolvedValue([])
    getSessionDiff.mockResolvedValue([
      {
        file: 'src/session.ts',
        before: 'const session = 1',
        after: 'const session = 2',
        additions: 1,
        deletions: 1,
      },
    ])
    getLastTurnDiff.mockResolvedValue([
      {
        file: 'src/turn.ts',
        before: '',
        after: 'const turn = 1',
        additions: 1,
        deletions: 0,
      },
    ])
  })

  it('reloads preview content when force refresh is requested', async () => {
    getFileContent
      .mockResolvedValueOnce({ type: 'text', content: 'v1' })
      .mockResolvedValueOnce({ type: 'text', content: 'v2' })

    const { result } = renderHook(() => useFileExplorer({ directory: '/workspace/project', autoLoad: false }))

    await act(async () => {
      await result.current.loadPreview('README.md')
    })
    await waitFor(() => {
      expect(result.current.previewContent?.content).toBe('v1')
    })

    await act(async () => {
      await result.current.loadPreview('README.md', { forceRefresh: true })
    })
    await waitFor(() => {
      expect(result.current.previewContent?.content).toBe('v2')
    })

    expect(getFileContent).toHaveBeenCalledTimes(2)
  })

  it('loads preview content for unsupported root paths via api fallback without surfacing preview errors', async () => {
    getFileContent.mockResolvedValueOnce({ type: 'text', content: 'outside root file' })

    const { result } = renderHook(() => useFileExplorer({ directory: '/root', autoLoad: false }))

    await act(async () => {
      await result.current.loadPreview('outside.txt')
    })

    await waitFor(() => {
      expect(result.current.previewContent?.content).toBe('outside root file')
    })
    expect(result.current.previewError).toBeNull()
    expect(getFileContent).toHaveBeenCalledWith('outside.txt', '/root')
  })

  it('exposes file service availability state', async () => {
    getFileServiceAvailability.mockResolvedValue(false)

    const { result } = renderHook(() => useFileExplorer({ directory: '/workspace/project', autoLoad: false }))

    await waitFor(() => {
      expect(result.current.fileServiceAvailable).toBe(false)
    })
  })

  it('updates file statuses when the shared change mode changes', async () => {
    const { result } = renderHook(() => useFileExplorer({ directory: '/repo', autoLoad: true, sessionId: 'session-1' }))

    await waitFor(() => {
      expect(result.current.fileStatus.get('src/turn.ts')?.status).toBe('added')
    })

    expect(getLastTurnDiff).toHaveBeenCalledWith('session-1', '/repo')

    act(() => {
      changeScopeStore.setMode('session-1', 'session')
    })

    await waitFor(() => {
      expect(result.current.fileStatus.get('src/session.ts')?.status).toBe('modified')
    })

    expect(result.current.fileStatus.get('src/turn.ts')).toBeUndefined()
    expect(getSessionDiff).toHaveBeenCalledWith('session-1', '/repo')
  })

  it('restores expanded folders per directory when switching projects', async () => {
    listDirectory.mockImplementation(async (parentPath: string, directory: string) => {
      if (parentPath === '') {
        return [{ name: 'src', path: 'src', absolute: `${directory}/src`, type: 'directory', ignored: false }]
      }

      if (parentPath === 'src') {
        return [
          {
            name: directory === '/repo-a' ? 'a.ts' : 'b.ts',
            path: `src/${directory === '/repo-a' ? 'a.ts' : 'b.ts'}`,
            absolute: `${directory}/src/${directory === '/repo-a' ? 'a.ts' : 'b.ts'}`,
            type: 'file',
            ignored: false,
          },
        ]
      }

      return []
    })

    const { result, rerender } = renderHook(
      ({ directory }) => useFileExplorer({ directory, autoLoad: true }),
      { initialProps: { directory: '/repo-a' } },
    )

    await waitFor(() => {
      expect(result.current.tree).toHaveLength(1)
    })

    act(() => {
      result.current.toggleExpand('src')
    })

    await waitFor(() => {
      expect(result.current.expandedPaths.has('src')).toBe(true)
      expect(result.current.tree[0]?.children?.[0]?.path).toBe('src/a.ts')
    })

    rerender({ directory: '/repo-b' })

    await waitFor(() => {
      expect(result.current.tree[0]?.absolute).toBe('/repo-b/src')
      expect(result.current.tree[0]?.children?.[0]?.path).toBeUndefined()
      expect(result.current.expandedPaths.has('src')).toBe(false)
    })

    rerender({ directory: '/repo-a' })

    await waitFor(() => {
      expect(result.current.tree[0]?.absolute).toBe('/repo-a/src')
      expect(result.current.expandedPaths.has('src')).toBe(true)
      expect(result.current.tree[0]?.children?.[0]?.path).toBe('src/a.ts')
    })
  })

  it('ignores stale child loads after switching directories', async () => {
    let resolveRepoAChildren: (nodes: Array<{ name: string; path: string; absolute: string; type: 'file'; ignored: boolean }>) => void

    listDirectory.mockImplementation((parentPath: string, directory: string) => {
      if (parentPath === '') {
        return Promise.resolve([{ name: 'src', path: 'src', absolute: `${directory}/src`, type: 'directory', ignored: false }])
      }

      if (parentPath === 'src' && directory === '/repo-a') {
        return new Promise(resolve => {
          resolveRepoAChildren = resolve
        })
      }

      if (parentPath === 'src' && directory === '/repo-b') {
        return Promise.resolve([
          { name: 'b.ts', path: 'src/b.ts', absolute: '/repo-b/src/b.ts', type: 'file', ignored: false },
        ])
      }

      return Promise.resolve([])
    })

    const { result, rerender } = renderHook(
      ({ directory }) => useFileExplorer({ directory, autoLoad: true }),
      { initialProps: { directory: '/repo-a' } },
    )

    await waitFor(() => {
      expect(result.current.tree[0]?.absolute).toBe('/repo-a/src')
    })

    act(() => {
      result.current.toggleExpand('src')
    })

    rerender({ directory: '/repo-b' })

    await waitFor(() => {
      expect(result.current.tree[0]?.absolute).toBe('/repo-b/src')
    })

    act(() => {
      result.current.toggleExpand('src')
    })

    await waitFor(() => {
      expect(result.current.tree[0]?.children?.[0]?.path).toBe('src/b.ts')
    })

    await act(async () => {
      resolveRepoAChildren!([
        { name: 'a.ts', path: 'src/a.ts', absolute: '/repo-a/src/a.ts', type: 'file', ignored: false },
      ])
    })

    expect(result.current.tree[0]?.absolute).toBe('/repo-b/src')
    expect(result.current.tree[0]?.children?.map(child => child.path)).toEqual(['src/b.ts'])
  })
})
