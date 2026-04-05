import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileExplorer } from './FileExplorer'
import type { FileContent } from '../api/types'

const toggleExpandMock = vi.fn()
const loadPreviewMock = vi.fn()
const clearPreviewMock = vi.fn()
const updatePreviewContentMock = vi.fn()
const downloadDirectoryArchiveMock = vi.fn()
const downloadFileAssetMock = vi.fn()
const saveFileContentMock = vi.fn()
const downloadBlobMock = vi.fn()
const updateFilePreviewMock = vi.fn()
let previewContentMock: FileContent | null = null

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
    previewContent: previewContentMock,
    previewLoading: false,
    previewError: null,
    loadPreview: loadPreviewMock,
    clearPreview: clearPreviewMock,
    updatePreviewContent: updatePreviewContentMock,
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
    saveFileContent: (...args: unknown[]) => saveFileContentMock(...args),
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
    updateFilePreview: (...args: unknown[]) => updateFilePreviewMock(...args),
  },
}))

describe('FileExplorer directory download', () => {
  beforeEach(() => {
    previewContentMock = null
    toggleExpandMock.mockReset()
    loadPreviewMock.mockReset()
    clearPreviewMock.mockReset()
    updatePreviewContentMock.mockReset()
    downloadDirectoryArchiveMock.mockReset()
    downloadFileAssetMock.mockReset()
    saveFileContentMock.mockReset()
    downloadBlobMock.mockReset()
    updateFilePreviewMock.mockReset()
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

  it('edits text content and saves through file api', async () => {
    previewContentMock = {
      type: 'text',
      content: 'hello',
      mimeType: 'text/plain',
    }
    saveFileContentMock.mockResolvedValue({
      path: 'README.md',
      savedAt: '2026-04-05T00:00:00.000Z',
    })

    render(
      <FileExplorer
        panelTabId="files"
        directory="/workspace/project"
        previewFile={{ path: 'README.md', name: 'README.md' }}
        previewFiles={[{ path: 'README.md', name: 'README.md' }]}
      />,
    )

    fireEvent.change(screen.getByLabelText('editor README.md'), {
      target: { value: 'hello world' },
    })

    await waitFor(() => {
      expect(updateFilePreviewMock).toHaveBeenCalledWith(
        'files',
        'README.md',
        expect.objectContaining({ isDirty: true }),
      )
    })

    fireEvent.click(screen.getByLabelText('common:save README.md'))

    await waitFor(() => {
      expect(saveFileContentMock).toHaveBeenCalledWith('README.md', 'hello world', '/workspace/project', {
        expectedContent: 'hello',
      })
    })
    expect(updatePreviewContentMock).toHaveBeenCalledWith(
      'README.md',
      expect.objectContaining({ content: 'hello world' }),
    )
  })

  it('uses refreshed preview content as save baseline after reload', async () => {
    previewContentMock = {
      type: 'text',
      content: 'v1',
      mimeType: 'text/plain',
    }

    const view = render(
      <FileExplorer
        panelTabId="files"
        directory="/workspace/project"
        previewFile={{ path: 'README.md', name: 'README.md' }}
        previewFiles={[{ path: 'README.md', name: 'README.md' }]}
      />,
    )

    previewContentMock = {
      type: 'text',
      content: 'v2',
      mimeType: 'text/plain',
    }

    view.rerender(
      <FileExplorer
        panelTabId="files"
        directory="/workspace/project"
        previewFile={{ path: 'README.md', name: 'README.md' }}
        previewFiles={[{ path: 'README.md', name: 'README.md' }]}
      />,
    )

    saveFileContentMock.mockResolvedValue({
      path: 'README.md',
      savedAt: '2026-04-05T00:00:00.000Z',
    })

    fireEvent.change(screen.getByLabelText('editor README.md'), {
      target: { value: 'v3' },
    })
    fireEvent.click(screen.getByLabelText('common:save README.md'))

    await waitFor(() => {
      expect(saveFileContentMock).toHaveBeenCalledWith('README.md', 'v3', '/workspace/project', {
        expectedContent: 'v2',
      })
    })
  })
})
