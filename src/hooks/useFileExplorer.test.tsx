import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileExplorer } from './useFileExplorer'

const getFileContentMock = vi.fn()
const getFileServiceAvailabilityMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../api', () => ({
  listDirectory: vi.fn().mockResolvedValue([]),
  getFileContent: (...args: unknown[]) => getFileContentMock(...args),
  getFileServiceAvailability: (...args: unknown[]) => getFileServiceAvailabilityMock(...args),
  getFileStatus: vi.fn().mockResolvedValue([]),
  getSessionDiff: vi.fn().mockResolvedValue([]),
}))

describe('useFileExplorer', () => {
  beforeEach(() => {
    getFileContentMock.mockReset()
    getFileServiceAvailabilityMock.mockReset()
    getFileServiceAvailabilityMock.mockResolvedValue(true)
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

  it('exposes file service availability state', async () => {
    getFileServiceAvailabilityMock.mockResolvedValue(false)

    const { result } = renderHook(() => useFileExplorer({ directory: '/workspace/project', autoLoad: false }))

    await waitFor(() => {
      expect(result.current.fileServiceAvailable).toBe(false)
    })
  })
})
