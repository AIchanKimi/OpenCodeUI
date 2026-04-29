import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DirectoryProvider } from './DirectoryContext'
import { useDirectory } from './useDirectory'

const setDirectoryMock = vi.fn()

vi.mock('../api', () => ({
  getPath: vi.fn().mockResolvedValue({
    home: '/Users/test',
    state: '/tmp/state',
    config: '/tmp/config',
    worktree: '/workspace',
    directory: '/workspace',
  }),
}))

vi.mock('../hooks/useRouter', () => ({
  useRouter: () => ({
    directory: undefined,
    setDirectory: setDirectoryMock,
  }),
}))

vi.mock('../store/layoutStore', () => ({
  layoutStore: {
    setSidebarExpanded: vi.fn(),
  },
  useLayoutStore: () => ({
    sidebarExpanded: true,
  }),
}))

vi.mock('../store/serverStore', () => ({
  serverStore: {
    onServerChange: () => () => {},
  },
}))

vi.mock('../utils/tauri', () => ({
  isTauri: () => false,
}))

describe('DirectoryProvider root handling', () => {
  beforeEach(() => {
    setDirectoryMock.mockReset()
    window.localStorage.clear()
  })

  it('does not add root as a saved project', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <DirectoryProvider>{children}</DirectoryProvider>
    const { result } = renderHook(() => useDirectory(), { wrapper })

    await waitFor(() => expect(result.current.pathInfo).not.toBeNull())

    act(() => {
      result.current.addDirectory('/')
    })

    expect(result.current.savedDirectories).toEqual([])
    expect(setDirectoryMock).toHaveBeenCalledWith(undefined)
  })
})
