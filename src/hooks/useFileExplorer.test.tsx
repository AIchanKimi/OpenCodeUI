import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileExplorer } from './useFileExplorer'

const getFileContentMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../api', () => ({
  listDirectory: vi.fn().mockResolvedValue([]),
  getFileContent: (...args: unknown[]) => getFileContentMock(...args),
  getFileStatus: vi.fn().mockResolvedValue([]),
  getSessionDiff: vi.fn().mockResolvedValue([]),
}))

describe('useFileExplorer', () => {
  beforeEach(() => {
    getFileContentMock.mockReset()
  })

  it('reloads preview content when force refresh is requested', async () => {
    getFileContentMock
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

    expect(getFileContentMock).toHaveBeenCalledTimes(2)
  })
})
