import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileExplorer } from './FileExplorer'

const toggleExpandMock = vi.fn()
const loadPreviewMock = vi.fn()
const clearPreviewMock = vi.fn()
const downloadDirectoryArchiveMock = vi.fn()
const downloadFileAssetMock = vi.fn()
const downloadBlobMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../hooks', () => ({
  useFileExplorer: () => ({
    tree: [
      { path: 'src', name: 'src', type: 'directory', absolute: '/workspace/project/src' },
      { path: 'README.md', name: 'README.md', type: 'file', absolute: '/workspace/project/README.md' },
    ],
    isLoading: false,
    error: null,
    expandedPaths: new Set<string>(),
    toggleExpand: toggleExpandMock,
    previewContent: null,
    previewLoading: false,
    previewError: null,
    loadPreview: loadPreviewMock,
    clearPreview: clearPreviewMock,
    fileStatus: new Map(),
    refresh: vi.fn(),
  }),
}))

vi.mock('../hooks/useVerticalSplitResize', () => ({
  useVerticalSplitResize: () => ({
    splitHeight: null,
    isResizing: false,
    resetSplitHeight: vi.fn(),
    handleResizeStart: vi.fn(),
    handleTouchResizeStart: vi.fn(),
  }),
}))

vi.mock('../api/file', async () => {
  const actual = await vi.importActual('../api/file')
  return {
    ...actual,
    downloadDirectoryArchive: (...args: unknown[]) => downloadDirectoryArchiveMock(...args),
    downloadFileAsset: (...args: unknown[]) => downloadFileAssetMock(...args),
  }
})

vi.mock('../utils/downloadUtils', async () => {
  const actual = await vi.importActual('../utils/downloadUtils')
  return {
    ...actual,
    downloadBlob: (...args: unknown[]) => downloadBlobMock(...args),
  }
})

vi.mock('../store/layoutStore', () => ({
  layoutStore: {
    openFilePreview: vi.fn(),
    closeAllFilePreviews: vi.fn(),
    activateFilePreview: vi.fn(),
    closeFilePreview: vi.fn(),
    reorderFilePreviews: vi.fn(),
  },
}))

describe('FileExplorer directory download', () => {
  beforeEach(() => {
    toggleExpandMock.mockReset()
    loadPreviewMock.mockReset()
    clearPreviewMock.mockReset()
    downloadDirectoryArchiveMock.mockReset()
    downloadFileAssetMock.mockReset()
    downloadBlobMock.mockReset()
  })

  it('renders download actions for both directories and files', () => {
    render(<FileExplorer panelTabId="files" directory="/workspace/project" previewFile={null} previewFiles={[]} />)

    expect(screen.getByLabelText('download src')).toBeInTheDocument()
    expect(screen.getByLabelText('download README.md')).toBeInTheDocument()
  })

  it('downloads a directory archive without toggling the directory row', async () => {
    downloadDirectoryArchiveMock.mockResolvedValue({
      blob: new Blob(['zip-data'], { type: 'application/zip' }),
      fileName: 'src.zip',
    })

    render(<FileExplorer panelTabId="files" directory="/workspace/project" previewFile={null} previewFiles={[]} />)

    fireEvent.click(screen.getByLabelText('download src'))

    await waitFor(() => {
      expect(downloadDirectoryArchiveMock).toHaveBeenCalledWith('src', '/workspace/project')
    })
    expect(downloadBlobMock).toHaveBeenCalledTimes(1)
    expect(toggleExpandMock).not.toHaveBeenCalled()
  })

  it('downloads a file asset without opening preview', async () => {
    downloadFileAssetMock.mockResolvedValue({
      blob: new Blob(['hello world'], { type: 'text/plain' }),
      fileName: 'README.md',
    })

    render(<FileExplorer panelTabId="files" directory="/workspace/project" previewFile={null} previewFiles={[]} />)

    fireEvent.click(screen.getByLabelText('download README.md'))

    await waitFor(() => {
      expect(downloadFileAssetMock).toHaveBeenCalledWith('README.md', '/workspace/project')
    })
    expect(downloadBlobMock).toHaveBeenCalledTimes(1)
    expect(toggleExpandMock).not.toHaveBeenCalled()
  })
})
