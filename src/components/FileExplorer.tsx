// ============================================
// FileExplorer - 文件浏览器组件
// 包含文件树和文件预览两个区域，支持拖拽调整高度
// 性能优化：使用 CSS 变量 + requestAnimationFrame 处理 resize
// ============================================

import {
  memo,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useFileExplorer, type FileTreeNode } from '../hooks'
import { useVerticalSplitResize } from '../hooks/useVerticalSplitResize'
import { useHorizontalSplitResize } from '../hooks/useHorizontalSplitResize'
import { layoutStore, type PreviewFile } from '../store/layoutStore'
import {
  ChevronRightIcon,
  ChevronDownIcon,
  RetryIcon,
  AlertCircleIcon,
  DownloadIcon,
  MaximizeIcon,
  SpinnerIcon,
} from './Icons'
import { notificationStore } from '../store/notificationStore'
import { CodePreview } from './CodePreview'
import { FullscreenViewer } from './FullscreenViewer'
import { PreviewTabsBar, type PreviewTabsBarItem } from './PreviewTabsBar'
import { getMaterialIconUrl } from '../utils/materialIcons'
import { detectLanguage } from '../utils/languageUtils'
import {
  getPreviewCategory,
  isBinaryContent,
  isTextualMedia,
  buildDataUrl,
  buildTextDataUrl,
  decodeBase64Text,
  formatMimeType,
  type PreviewCategory,
} from '../utils/mimeUtils'
import { downloadBlob, downloadFileContent } from '../utils/downloadUtils'
import { downloadDirectoryArchive, downloadFileAsset, isFileServicePathSupported, saveFileContent } from '../api/file'
import type { FileContent } from '../api/types'
import { FileTextEditor } from './file-text-editor'

// 常量
const MIN_TREE_HEIGHT = 100
const MIN_PREVIEW_HEIGHT = 150
const MIN_TREE_WIDTH = 200
const MIN_PREVIEW_WIDTH = 360
const HORIZONTAL_LAYOUT_BREAKPOINT = 1000

interface EditorDraftState {
  originalContent: string
  draftContent: string
  isSaving: boolean
  saveError: string | null
}

function isEditableTextContent(content: FileContent | null): content is FileContent {
  if (!content) return false
  if (isBinaryContent(content.encoding)) return false
  return !isTextualMedia(content.mimeType)
}

interface FileExplorerProps {
  panelTabId: string
  directory?: string
  previewFile: PreviewFile | null
  previewFiles: PreviewFile[]
  position?: 'bottom' | 'right'
  isPanelResizing?: boolean
  sessionId?: string | null
}

export const FileExplorer = memo(function FileExplorer({
  panelTabId,
  directory,
  previewFile,
  previewFiles,
  position = 'right',
  isPanelResizing = false,
  sessionId,
}: FileExplorerProps) {
  const { t } = useTranslation(['components', 'common'])
  const containerRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const [isHorizontalLayout, setIsHorizontalLayout] = useState(false)
  const {
    splitHeight: treeHeight,
    isResizing: isVerticalResizing,
    resetSplitHeight,
    handleResizeStart: handleVerticalResizeStart,
    handleTouchResizeStart: handleVerticalTouchResizeStart,
  } = useVerticalSplitResize({
    containerRef,
    primaryRef: treeRef,
    cssVariableName: '--tree-height',
    minPrimaryHeight: MIN_TREE_HEIGHT,
    minSecondaryHeight: MIN_PREVIEW_HEIGHT,
  })
  const {
    splitWidth: treeWidth,
    isResizing: isHorizontalResizing,
    resetSplitWidth,
    handleResizeStart: handleHorizontalResizeStart,
    handleTouchResizeStart: handleHorizontalTouchResizeStart,
  } = useHorizontalSplitResize({
    containerRef,
    primaryRef: treeRef,
    cssVariableName: '--tree-width',
    minPrimaryWidth: MIN_TREE_WIDTH,
    minSecondaryWidth: MIN_PREVIEW_WIDTH,
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') {
      return
    }

    const updateLayout = (width: number) => {
      setIsHorizontalLayout(width >= HORIZONTAL_LAYOUT_BREAKPOINT)
    }

    updateLayout(container.clientWidth)

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0]
      const nextWidth = entry?.contentRect.width ?? container.clientWidth
      updateLayout(nextWidth)
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    if (isHorizontalLayout) {
      resetSplitHeight()
      return
    }

    resetSplitWidth()
  }, [isHorizontalLayout, resetSplitHeight, resetSplitWidth])

  // 综合 resize 状态 - 外部面板 resize 或内部 resize
  const isAnyResizing = isPanelResizing || isVerticalResizing || isHorizontalResizing
  const [downloadingPaths, setDownloadingPaths] = useState<Set<string>>(new Set())
  const downloadingPathsRef = useRef<Set<string>>(new Set())
  const [editorDrafts, setEditorDrafts] = useState<Record<string, EditorDraftState>>({})

  const {
    tree,
    isLoading,
    error,
    expandedPaths,
    toggleExpand,
    previewContent,
    previewLoading,
    previewError,
    fileServiceAvailable,
    loadPreview,
    clearPreview,
    updatePreviewContent,
    fileStatus,
    refresh,
  } = useFileExplorer({ directory, autoLoad: true, sessionId: sessionId || undefined })

  // 当 previewFile 改变时加载预览
  useEffect(() => {
    if (previewFile) {
      loadPreview(previewFile.path, { forceRefresh: true })
    } else {
      clearPreview()
    }
  }, [previewFile, loadPreview, clearPreview])

  useEffect(() => {
    if (!fileServiceAvailable || !previewFile || !isEditableTextContent(previewContent)) {
      return
    }

    setEditorDrafts(prev => {
      const existing = prev[previewFile.path]
      if (existing) {
        if (existing.originalContent === previewContent.content) {
          return prev
        }

        const hasUnsavedChanges = existing.draftContent !== existing.originalContent
        return {
          ...prev,
          [previewFile.path]: {
            originalContent: previewContent.content,
            draftContent: hasUnsavedChanges ? existing.draftContent : previewContent.content,
            isSaving: existing.isSaving,
            saveError: null,
          },
        }
      }

      return {
        ...prev,
        [previewFile.path]: {
          originalContent: previewContent.content,
          draftContent: previewContent.content,
          isSaving: false,
          saveError: null,
        },
      }
    })
  }, [fileServiceAvailable, previewContent, previewFile])

  useEffect(() => {
    setEditorDrafts(prev => {
      const previewPaths = new Set(previewFiles.map(file => file.path))
      let changed = false
      const nextDrafts: Record<string, EditorDraftState> = {}

      Object.entries(prev).forEach(([path, state]) => {
        if (previewPaths.has(path)) {
          nextDrafts[path] = state
          return
        }

        changed = true
      })

      return changed ? nextDrafts : prev
    })
  }, [previewFiles])

  useEffect(() => {
    previewFiles.forEach(file => {
      const draftState = editorDrafts[file.path]
      const nextIsDirty = draftState ? draftState.draftContent !== draftState.originalContent : false
      const nextIsSaving = draftState?.isSaving ?? false
      const nextSaveError = draftState?.saveError ?? null

      if (
        file.isDirty === nextIsDirty &&
        file.isSaving === nextIsSaving &&
        (file.saveError ?? null) === nextSaveError
      ) {
        return
      }

      layoutStore.updateFilePreview(panelTabId, file.path, {
        isDirty: nextIsDirty,
        isSaving: nextIsSaving,
        saveError: nextSaveError,
      })
    })
  }, [editorDrafts, panelTabId, previewFiles])

  // 处理文件点击
  const handleFileClick = useCallback(
    (node: FileTreeNode) => {
      if (node.type === 'directory') {
        toggleExpand(node.path)
      } else {
        layoutStore.openFilePreview({ path: node.path, name: node.name }, position)
      }
    },
    [toggleExpand, position],
  )

  const handleNodeDownload = useCallback(
    async (node: FileTreeNode) => {
      if (!fileServiceAvailable || !isFileServicePathSupported(node.path, directory)) {
        return
      }

      if (downloadingPathsRef.current.has(node.path)) {
        return
      }

      downloadingPathsRef.current = new Set(downloadingPathsRef.current).add(node.path)
      setDownloadingPaths(new Set(downloadingPathsRef.current))

      try {
        const { blob, fileName } =
          node.type === 'directory'
            ? await downloadDirectoryArchive(node.path, directory)
            : await downloadFileAsset(node.path, directory)
        downloadBlob(blob, fileName)
      } catch (error) {
        const message = error instanceof Error ? error.message : t('common:error')
        notificationStore.push('error', t('common:download'), message, sessionId || 'file-explorer', directory)
      } finally {
        const next = new Set(downloadingPathsRef.current)
        next.delete(node.path)
        downloadingPathsRef.current = next
        setDownloadingPaths(new Set(next))
      }
    },
    [directory, fileServiceAvailable, sessionId, t],
  )

  const handleEditorChange = useCallback((path: string, value: string) => {
    setEditorDrafts(prev => {
      const current = prev[path]
      if (!current || current.draftContent === value) {
        return prev
      }

      return {
        ...prev,
        [path]: {
          ...current,
          draftContent: value,
          saveError: null,
        },
      }
    })
  }, [])

  const handleSavePreview = useCallback(async () => {
    if (!fileServiceAvailable || !previewFile) {
      return
    }

    const draftState = editorDrafts[previewFile.path]
    if (!draftState || draftState.isSaving || draftState.draftContent === draftState.originalContent) {
      return
    }

    setEditorDrafts(prev => ({
      ...prev,
      [previewFile.path]: {
        ...draftState,
        isSaving: true,
        saveError: null,
      },
    }))

    try {
      await saveFileContent(previewFile.path, draftState.draftContent, directory, {
        expectedContent: draftState.originalContent,
      })

      updatePreviewContent(previewFile.path, {
        ...(previewContent ?? { type: 'text' as const }),
        type: 'text',
        content: draftState.draftContent,
      })

      setEditorDrafts(prev => ({
        ...prev,
        [previewFile.path]: {
          originalContent: draftState.draftContent,
          draftContent: draftState.draftContent,
          isSaving: false,
          saveError: null,
        },
      }))

      notificationStore.push('completed', t('common:save'), previewFile.name, sessionId || 'file-explorer', directory)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common:error')

      setEditorDrafts(prev => ({
        ...prev,
        [previewFile.path]: {
          ...(prev[previewFile.path] ?? draftState),
          isSaving: false,
          saveError: message,
        },
      }))

      notificationStore.push('error', t('common:save'), message, sessionId || 'file-explorer', directory)
    }
  }, [directory, editorDrafts, fileServiceAvailable, previewContent, previewFile, sessionId, t, updatePreviewContent])

  const activeEditorState = previewFile ? (editorDrafts[previewFile.path] ?? null) : null

  // 关闭预览
  const handleClosePreview = useCallback(() => {
    layoutStore.closeAllFilePreviews(panelTabId)
    resetSplitHeight()
    resetSplitWidth()
  }, [panelTabId, resetSplitHeight, resetSplitWidth])

  const handleActivatePreview = useCallback(
    (path: string) => {
      layoutStore.activateFilePreview(panelTabId, path)
    },
    [panelTabId],
  )

  const handleClosePreviewTab = useCallback(
    (path: string) => {
      layoutStore.closeFilePreview(panelTabId, path)
    },
    [panelTabId],
  )

  const handleReorderPreviewTabs = useCallback(
    (draggedPath: string, targetPath: string) => {
      layoutStore.reorderFilePreviews(panelTabId, draggedPath, targetPath)
    },
    [panelTabId],
  )

  // 是否显示预览
  const showPreview = Boolean(previewFile) || previewLoading || Boolean(previewError)

  // 没有选择目录
  if (!directory) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-400 text-sm gap-2 p-4">
        <img
          src={getMaterialIconUrl('folder', 'directory', false)}
          alt=""
          width={32}
          height={32}
          className="opacity-30"
          onError={e => {
            e.currentTarget.style.visibility = 'hidden'
          }}
        />
        <span className="text-center">{t('fileExplorer.selectProject')}</span>
      </div>
    )
  }

  const activeResizeStart = isHorizontalLayout ? handleHorizontalResizeStart : handleVerticalResizeStart
  const activeTouchResizeStart = isHorizontalLayout ? handleHorizontalTouchResizeStart : handleVerticalTouchResizeStart
  const isResizing = isHorizontalLayout ? isHorizontalResizing : isVerticalResizing

  return (
    <div ref={containerRef} className={`flex h-full min-h-0 min-w-0 ${isHorizontalLayout ? 'flex-row' : 'flex-col'}`}>
      {/* File Tree - 使用 CSS 变量控制主区域尺寸 */}
      <div
        ref={treeRef}
        className="overflow-hidden flex flex-col shrink-0"
        style={
          {
            '--tree-height': treeHeight !== null ? `${treeHeight}px` : '40%',
            '--tree-width': treeWidth !== null ? `${treeWidth}px` : `${MIN_TREE_WIDTH}px`,
            width: showPreview && isHorizontalLayout ? 'var(--tree-width)' : '100%',
            height: showPreview && !isHorizontalLayout ? 'var(--tree-height)' : '100%',
            minHeight: showPreview && !isHorizontalLayout ? MIN_TREE_HEIGHT : undefined,
            minWidth: showPreview && isHorizontalLayout ? MIN_TREE_WIDTH : undefined,
          } as React.CSSProperties
        }
      >
        {/* Tree Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-100/50 shrink-0">
          <span className="text-[10px] font-bold text-text-400 uppercase tracking-wider">
            {t('fileExplorer.explorer')}
          </span>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1 text-text-400 hover:text-text-100 hover:bg-bg-200 rounded transition-colors disabled:opacity-50"
            title={t('common:refresh')}
          >
            <RetryIcon size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tree Content */}
        <div className="flex-1 overflow-auto panel-scrollbar-y">
          {isLoading && tree.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-text-400 text-xs">{t('common:loading')}</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-20 text-danger-100 text-xs gap-1 px-4">
              <AlertCircleIcon size={16} />
              <span className="text-center">{error}</span>
            </div>
          ) : tree.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-text-400 text-xs">
              {t('fileExplorer.noFilesFound')}
            </div>
          ) : (
            <div className="py-1">
              {tree.map(node => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  expandedPaths={expandedPaths}
                  fileStatus={fileStatus}
                  onClick={handleFileClick}
                  onDownload={handleNodeDownload}
                  showDownload={fileServiceAvailable}
                  canDownloadPath={path => isFileServicePathSupported(path, directory)}
                  isDownloadingPath={path => downloadingPaths.has(path)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle - 与标签栏同色 */}
      {showPreview && (
        <div
          className={`
            shrink-0 relative
            hover:bg-accent-main-100/50 active:bg-accent-main-100 transition-colors
            ${isHorizontalLayout ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'}
            ${isResizing ? 'bg-accent-main-100' : 'bg-bg-200/60'}
          `}
          onMouseDown={activeResizeStart}
          onTouchStart={activeTouchResizeStart}
        />
      )}

      {/* Preview Area */}
      {showPreview && (
        <div
          className="flex-1 flex flex-col min-h-0 min-w-0"
          style={isHorizontalLayout ? { minWidth: MIN_PREVIEW_WIDTH } : { minHeight: MIN_PREVIEW_HEIGHT }}
        >
          <FilePreview
            directory={directory}
            previewFiles={previewFiles}
            path={previewFile?.path ?? null}
            content={previewContent}
            fileServiceAvailable={fileServiceAvailable}
            editorText={activeEditorState?.draftContent ?? null}
            isDirty={Boolean(activeEditorState && activeEditorState.draftContent !== activeEditorState.originalContent)}
            isSaving={activeEditorState?.isSaving ?? false}
            saveError={activeEditorState?.saveError ?? null}
            isLoading={previewLoading}
            error={previewError}
            onClose={handleClosePreview}
            onEditorChange={value => {
              if (!previewFile) return
              handleEditorChange(previewFile.path, value)
            }}
            onSave={handleSavePreview}
            onActivatePreview={handleActivatePreview}
            onClosePreview={handleClosePreviewTab}
            onReorderPreview={handleReorderPreviewTabs}
            isResizing={isAnyResizing}
          />
        </div>
      )}
    </div>
  )
})

// ============================================
// File Tree Item
// ============================================

interface FileTreeItemProps {
  node: FileTreeNode
  depth: number
  expandedPaths: Set<string>
  fileStatus: Map<string, { status: string }>
  onClick: (node: FileTreeNode) => void
  onDownload: (node: FileTreeNode) => void
  showDownload: boolean
  canDownloadPath: (path: string) => boolean
  isDownloadingPath: (path: string) => boolean
}

const FileTreeItem = memo(function FileTreeItem({
  node,
  depth,
  expandedPaths,
  fileStatus,
  onClick,
  onDownload,
  showDownload,
  canDownloadPath,
  isDownloadingPath,
}: FileTreeItemProps) {
  const { t } = useTranslation('common')
  const isExpanded = expandedPaths.has(node.path)
  const isDirectory = node.type === 'directory'
  // node.path 可能用反斜杠（Windows），statusMap key 统一用正斜杠
  const status = fileStatus.get(node.path) || fileStatus.get(node.path.replace(/\\/g, '/'))

  // 状态颜色
  const statusColor = useMemo(() => {
    if (!status) return null
    switch (status.status) {
      case 'added':
        return 'text-success-100'
      case 'modified':
        return 'text-warning-100'
      case 'deleted':
        return 'text-danger-100'
      default:
        return null
    }
  }, [status])

  // 拖拽到输入框实现 @mention
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>) => {
      const fileData = {
        type: (isDirectory ? 'folder' : 'file') as 'file' | 'folder',
        path: node.path, // 相对路径
        absolute: node.absolute, // 绝对路径
        name: node.name,
      }
      e.dataTransfer.setData('application/opencode-file', JSON.stringify(fileData))
      e.dataTransfer.effectAllowed = 'copy'
    },
    [node.path, node.absolute, node.name, isDirectory],
  )

  const handleDownloadClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onDownload(node)
    },
    [node, onDownload],
  )

  return (
    <div>
      <div className={`group flex items-center gap-1 pr-2 ${node.ignored ? 'opacity-50' : ''}`}>
        <button
          draggable
          onDragStart={handleDragStart}
          onClick={() => onClick(node)}
          className={`
            flex-1 flex items-center gap-1 px-2 py-0.5 text-left cursor-default
            hover:bg-bg-200/50 transition-colors text-[12px]
            text-text-300 min-w-0
          `}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {/* Expand/Collapse Icon */}
          {isDirectory ? (
            <span className="w-4 h-4 flex items-center justify-center text-text-400 shrink-0">
              {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* File/Folder Icon - Material Icon Theme */}
          <img
            src={getMaterialIconUrl(node.path, isDirectory ? 'directory' : 'file', isExpanded)}
            alt=""
            width={16}
            height={16}
            className="shrink-0"
            loading="lazy"
            decoding="async"
            onError={e => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />

          {/* Name */}
          <span className={`truncate flex-1 ${statusColor || ''}`}>{node.name}</span>

          {/* Loading Indicator */}
          {node.isLoading && (
            <span className="w-3 h-3 border border-text-400 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
        </button>

        {showDownload && canDownloadPath(node.path) ? (
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isDownloadingPath(node.path)}
            aria-label={`${t('download')} ${node.name}`}
            title={`${t('download')} ${node.name}`}
            className="shrink-0 p-1 text-text-400 hover:text-text-100 hover:bg-bg-200/60 rounded transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
          >
            {isDownloadingPath(node.path) ? (
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin block" />
            ) : (
              <DownloadIcon size={12} />
            )}
          </button>
        ) : null}
      </div>

      {/* Children */}
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              fileStatus={fileStatus}
              onClick={onClick}
              onDownload={onDownload}
              showDownload={showDownload}
              canDownloadPath={canDownloadPath}
              isDownloadingPath={isDownloadingPath}
            />
          ))}
        </div>
      )}
    </div>
  )
})

// ============================================
// File Preview
// ============================================

interface FilePreviewProps {
  directory?: string
  previewFiles: PreviewFile[]
  path: string | null
  content: FileContent | null
  fileServiceAvailable: boolean
  editorText: string | null
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  isLoading: boolean
  error: string | null
  onClose: () => void
  onEditorChange: (value: string) => void
  onSave: () => void
  onActivatePreview: (path: string) => void
  onClosePreview: (path: string) => void
  onReorderPreview: (draggedPath: string, targetPath: string) => void
  isResizing?: boolean
}

function FilePreview({
  directory,
  previewFiles,
  path,
  content,
  fileServiceAvailable,
  editorText,
  isDirty,
  isSaving,
  saveError,
  isLoading,
  error,
  onClose,
  onEditorChange,
  onSave,
  onActivatePreview,
  onClosePreview,
  onReorderPreview,
  isResizing = false,
}: FilePreviewProps) {
  const { t } = useTranslation(['components', 'common'])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const fileServicePathSupported = path ? isFileServicePathSupported(path, directory) : false
  const canUseFileServiceActions = fileServiceAvailable && fileServicePathSupported

  // 获取文件名
  const fileName = path?.split(/[/\\]/).pop() || 'Untitled'
  const language = path ? detectLanguage(path) : 'text'
  const editableText = displayEditableText(editorText, content, canUseFileServiceActions)
  const showEditableText = displayContentType(content) === 'text' && editableText !== null

  // 下载当前文件
  const handleDownload = useCallback(() => {
    if (!path) return

    if (!canUseFileServiceActions) {
      if (content) {
        downloadFileContent(content, fileName)
      }
      return
    }

    downloadFileAsset(path, directory)
      .then(({ blob, fileName: downloadFileName }) => {
        downloadBlob(blob, downloadFileName)
      })
      .catch(error => {
        if (content && !isBinaryContent(content.encoding)) {
          downloadFileContent(content, fileName)
          return
        }

        const message = error instanceof Error ? error.message : t('common:error')
        notificationStore.push('error', t('common:download'), message, 'file-preview', directory)
      })
  }, [canUseFileServiceActions, content, directory, fileName, path, t])

  const previewTabItems = useMemo<PreviewTabsBarItem[]>(
    () =>
      previewFiles.map(file => ({
        id: file.path,
        title: file.path,
        closeTitle: `${t('common:close')} ${file.name}`,
        iconPath: file.path,
        label: (
          <span className="block min-w-0 flex-1 truncate text-[11px] font-mono">
            {file.name}
            {file.isSaving ? ' [..]' : file.isDirty ? ' *' : ''}
          </span>
        ),
      })),
    [previewFiles, t],
  )

  // 处理内容类型分发
  const displayContent = useMemo(() => {
    return buildDisplayContent(content)
  }, [content])

  const canSave = path !== null && editableText !== null && isDirty && !isSaving

  const renderSaveButton = useCallback(
    (size: 'compact' | 'fullscreen' = 'compact') => {
      if (!canUseFileServiceActions || editableText === null) {
        return null
      }

      return (
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          aria-label={`${t('common:save')} ${fileName}`}
          className={
            size === 'fullscreen'
              ? 'px-2.5 py-1.5 text-[11px] rounded border border-bg-300 text-text-300 hover:text-text-100 hover:bg-bg-300/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              : 'px-2 py-1 text-[11px] rounded border border-bg-300 text-text-300 hover:text-text-100 hover:bg-bg-300/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          }
          title={`${t('common:save')} ${fileName}`}
        >
          {isSaving ? <SpinnerIcon size={12} className="animate-spin" /> : t('common:save')}
        </button>
      )
    },
    [canSave, canUseFileServiceActions, editableText, fileName, isSaving, onSave, t],
  )

  const renderDownloadButton = useCallback(
    (size: 'compact' | 'fullscreen' = 'compact') => {
      if (!canUseFileServiceActions && !content) {
        return null
      }

      return (
        <button
          onClick={handleDownload}
          className={
            size === 'fullscreen'
              ? 'p-1.5 text-text-400 hover:text-text-100 hover:bg-bg-200/60 rounded-lg transition-colors'
              : 'p-1 text-text-400 hover:text-text-100 hover:bg-bg-300/50 rounded transition-colors'
          }
          aria-label={`${t('common:download')} ${fileName}`}
          title={`${t('common:download')} ${fileName}`}
        >
          <DownloadIcon size={size === 'fullscreen' ? 14 : 12} />
        </button>
      )
    },
    [canUseFileServiceActions, content, fileName, handleDownload, t],
  )

  const renderContent = useCallback(
    (isFullscreen: boolean) => {
      if (isLoading) {
        return (
          <div className="flex items-center justify-center h-full text-text-400 text-xs">{t('common:loading')}</div>
        )
      }

      if (error) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-danger-100 text-xs gap-1 px-4">
            <AlertCircleIcon size={16} />
            <span className="text-center">{error}</span>
          </div>
        )
      }

      if (displayContent?.type === 'text' && showEditableText) {
        return (
          <FileTextEditor
            fileName={fileName}
            value={editableText}
            language={language || 'text'}
            isDirty={isDirty}
            isSaving={isSaving}
            saveError={saveError}
            onChange={onEditorChange}
            onSave={onSave}
          />
        )
      }

      if (displayContent?.type === 'media') {
        return (
          <MediaPreview
            category={displayContent.category}
            dataUrl={displayContent.dataUrl}
            mimeType={displayContent.mimeType}
            fileName={fileName}
          />
        )
      }

      if (displayContent?.type === 'binary') {
        return <BinaryPlaceholder mimeType={displayContent.mimeType} fileName={fileName} onDownload={handleDownload} />
      }

      if (displayContent?.type === 'textMedia') {
        return (
          <TextMediaPreview
            dataUrl={displayContent.dataUrl}
            text={displayContent.text}
            language={language || 'xml'}
            fileName={fileName}
            isResizing={!isFullscreen && isResizing}
          />
        )
      }

      if (displayContent?.type === 'text') {
        return (
          <CodePreview
            code={displayContent.text}
            language={language || 'text'}
            isResizing={!isFullscreen && isResizing}
          />
        )
      }

      return (
        <div className="flex items-center justify-center h-full text-text-400 text-xs">{t('common:noContent')}</div>
      )
    },
    [
      displayContent,
      editableText,
      error,
      fileName,
      handleDownload,
      isDirty,
      isLoading,
      isResizing,
      isSaving,
      language,
      onEditorChange,
      onSave,
      saveError,
      showEditableText,
      t,
    ],
  )

  // 全屏内容
  const fullscreenContent = useMemo((): ReactNode => renderContent(true), [renderContent])

  return (
    <div className="flex flex-col h-full relative">
      <PreviewTabsBar
        items={previewTabItems}
        activeId={path}
        closeAllTitle={t('common:closeAllTabs')}
        onActivate={onActivatePreview}
        onClose={onClosePreview}
        onCloseAll={onClose}
        onReorder={onReorderPreview}
        tabWidthClassName="w-40 max-w-40"
        rightActions={
          content ? (
            <>
              {renderSaveButton()}
              <button
                onClick={() => setFullscreenOpen(true)}
                className="p-1 text-text-400 hover:text-text-100 hover:bg-bg-300/50 rounded transition-colors"
                title={t('contentBlock.fullscreen')}
              >
                <MaximizeIcon size={12} />
              </button>
              {renderDownloadButton()}
            </>
          ) : null
        }
      />

      {/* Preview Content */}
      <div ref={scrollRef} className="flex-1 overflow-auto panel-scrollbar min-h-0 min-w-0">
        {fullscreenOpen && showEditableText ? null : renderContent(false)}
      </div>

      <FullscreenViewer
        isOpen={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        title={fileName}
        headerRight={
          content ? (
            <>
              {renderSaveButton('fullscreen')}
              {renderDownloadButton('fullscreen')}
            </>
          ) : null
        }
      >
        {fullscreenContent}
      </FullscreenViewer>
    </div>
  )
}

function displayContentType(content: FileContent | null) {
  if (!content) return null

  if (isTextualMedia(content.mimeType)) {
    return 'textMedia' as const
  }

  if (isBinaryContent(content.encoding) && getPreviewCategory(content.mimeType)) {
    return 'media' as const
  }

  if (isBinaryContent(content.encoding)) {
    return 'binary' as const
  }

  return 'text' as const
}

function buildDisplayContent(content: FileContent | null) {
  if (!content) return null

  const category = getPreviewCategory(content.mimeType)

  if (isTextualMedia(content.mimeType)) {
    const isBase64 = isBinaryContent(content.encoding)
    const text = isBase64 ? decodeBase64Text(content.content) : content.content
    const dataUrl = isBase64
      ? buildDataUrl(content.mimeType!, content.content)
      : buildTextDataUrl(content.mimeType!, content.content)
    return {
      type: 'textMedia' as const,
      text,
      dataUrl,
      category: category!,
      mimeType: content.mimeType!,
    }
  }

  if (isBinaryContent(content.encoding) && category) {
    return {
      type: 'media' as const,
      category,
      dataUrl: buildDataUrl(content.mimeType!, content.content),
      mimeType: content.mimeType!,
    }
  }

  if (isBinaryContent(content.encoding)) {
    return {
      type: 'binary' as const,
      mimeType: content.mimeType || 'application/octet-stream',
    }
  }

  return {
    type: 'text' as const,
    text: content.content,
  }
}

function displayEditableText(
  editorText: string | null,
  content: FileContent | null,
  fileServiceAvailable: boolean,
): string | null {
  if (!fileServiceAvailable) {
    return null
  }

  if (!isEditableTextContent(content)) {
    return null
  }

  return editorText ?? content.content
}

// ============================================
// Media Preview - 路由到具体渲染器
// ============================================

interface MediaPreviewProps {
  category: PreviewCategory
  dataUrl: string
  mimeType: string
  fileName: string
}

function MediaPreview({ category, dataUrl, mimeType, fileName }: MediaPreviewProps) {
  switch (category) {
    case 'image':
      return <ImagePreview dataUrl={dataUrl} fileName={fileName} />
    case 'audio':
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
          <div className="text-text-400 text-xs">{formatMimeType(mimeType)}</div>
          <audio controls src={dataUrl} className="w-full max-w-xs" />
        </div>
      )
    case 'video':
      return (
        <div className="flex items-center justify-center h-full p-4">
          <video controls src={dataUrl} className="max-w-full max-h-full rounded" />
        </div>
      )
    case 'pdf':
      return <iframe src={dataUrl} title={fileName} className="w-full h-full border-0" />
  }
}

// ============================================
// Image Preview - 缩放 + 拖拽平移
// 直接滚轮缩放（以鼠标为锚点），左键拖拽平移
// ============================================

const MIN_ZOOM = 0.05
const MAX_ZOOM = 20
const ZOOM_FACTOR = 1.15 // 每次滚轮的缩放倍率

interface ImagePreviewProps {
  dataUrl: string
  fileName: string
}

function ImagePreview({ dataUrl, fileName }: ImagePreviewProps) {
  const { t } = useTranslation(['components', 'common'])
  const containerRef = useRef<HTMLDivElement>(null)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const scaleRef = useRef(1) // 同步访问，避免 stale closure
  const [scale, setScale] = useState(1)
  const [fitScale, setFitScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [initialized, setInitialized] = useState(false)
  const dragRef = useRef({ active: false, startX: 0, startY: 0 })

  // fit-to-container scale
  const computeFitScale = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !naturalSize.w || !naturalSize.h) return 1
      const rect = el.getBoundingClientRect()
      return Math.min(rect.width / naturalSize.w, rect.height / naturalSize.h, 1)
    },
    [naturalSize],
  )

  // 图片加载后初始化
  useEffect(() => {
    const container = containerRef.current
    if (!container || !naturalSize.w || !naturalSize.h) return

    const updateFitScale = () => {
      const nextFitScale = computeFitScale(container)
      setFitScale(nextFitScale)

      if (!initialized) {
        scaleRef.current = nextFitScale
        setScale(nextFitScale)
        setTranslate({ x: 0, y: 0 })
        setInitialized(true)
      }
    }

    updateFitScale()

    const resizeObserver = new ResizeObserver(updateFitScale)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [naturalSize, initialized, computeFitScale])

  // 滚轮缩放 — 以鼠标位置为锚点
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      // 鼠标相对容器中心
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR
      const oldScale = scaleRef.current
      const newScale = Math.min(Math.max(oldScale * factor, MIN_ZOOM), MAX_ZOOM)
      const ratio = newScale / oldScale
      scaleRef.current = newScale
      setScale(newScale)
      setTranslate(t => ({
        x: cx - ratio * (cx - t.x),
        y: cy - ratio * (cy - t.y),
      }))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // 拖拽平移
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      dragRef.current.startX = e.clientX
      dragRef.current.startY = e.clientY
      setTranslate(t => ({ x: t.x + dx, y: t.y + dy }))
    }
    const onUp = () => {
      if (dragRef.current.active) {
        dragRef.current.active = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }, [])

  const zoomIn = useCallback(() => {
    const s = Math.min(scaleRef.current * 1.25, MAX_ZOOM)
    scaleRef.current = s
    setScale(s)
  }, [])

  const zoomOut = useCallback(() => {
    const s = Math.max(scaleRef.current / 1.25, MIN_ZOOM)
    scaleRef.current = s
    setScale(s)
  }, [])

  const zoomFit = useCallback(() => {
    scaleRef.current = fitScale
    setScale(fitScale)
    setTranslate({ x: 0, y: 0 })
  }, [fitScale])

  const zoomActual = useCallback(() => {
    scaleRef.current = 1
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  const isFit = Math.abs(scale - fitScale) < 0.001 && translate.x === 0 && translate.y === 0
  const isActual = Math.abs(scale - 1) < 0.001 && translate.x === 0 && translate.y === 0

  return (
    <div className="flex flex-col h-full">
      {/* Zoom toolbar */}
      <div className="shrink-0 flex items-center justify-center gap-1.5 px-2 py-1 border-b border-border-100/30 bg-bg-100/50 text-[10px]">
        <button
          onClick={zoomOut}
          className="px-1.5 py-0.5 rounded hover:bg-bg-200 text-text-300 hover:text-text-100 transition-colors"
        >
          −
        </button>
        <span className="w-10 text-center text-text-400 tabular-nums">{Math.round(scale * 100)}%</span>
        <button
          onClick={zoomIn}
          className="px-1.5 py-0.5 rounded hover:bg-bg-200 text-text-300 hover:text-text-100 transition-colors"
        >
          +
        </button>
        <span className="w-px h-3 bg-border-200 mx-1" />
        <button
          onClick={zoomFit}
          className={`px-1.5 py-0.5 rounded transition-colors ${isFit ? 'bg-bg-200 text-text-100' : 'text-text-400 hover:bg-bg-200 hover:text-text-100'}`}
        >
          {t('fileExplorer.fit')}
        </button>
        <button
          onClick={zoomActual}
          className={`px-1.5 py-0.5 rounded transition-colors ${isActual ? 'bg-bg-200 text-text-100' : 'text-text-400 hover:bg-bg-200 hover:text-text-100'}`}
        >
          {t('fileExplorer.oneToOne')}
        </button>
      </div>
      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <img
          src={dataUrl}
          alt={fileName}
          draggable={false}
          className="absolute left-1/2 top-1/2 select-none"
          style={{
            transform: `translate(-50%, -50%) translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          onLoad={e => {
            setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }}
        />
      </div>
    </div>
  )
}

// ============================================
// Text Media Preview - 文本型可渲染媒体（如 SVG）
// 支持 Preview / Code 两种视图切换
// ============================================

interface TextMediaPreviewProps {
  dataUrl: string
  text: string
  language: string
  fileName: string
  isResizing?: boolean
}

function TextMediaPreview({ dataUrl, text, language, fileName, isResizing = false }: TextMediaPreviewProps) {
  const { t } = useTranslation(['components', 'common'])
  const [mode, setMode] = useState<'preview' | 'code'>('preview')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-0.5 px-2 py-1 border-b border-border-100/30 bg-bg-100/50 text-[10px]">
        <button
          onClick={() => setMode('preview')}
          className={`px-2 py-0.5 rounded transition-colors ${mode === 'preview' ? 'bg-bg-200 text-text-100' : 'text-text-400 hover:bg-bg-200 hover:text-text-100'}`}
        >
          {t('common:preview')}
        </button>
        <button
          onClick={() => setMode('code')}
          className={`px-2 py-0.5 rounded transition-colors ${mode === 'code' ? 'bg-bg-200 text-text-100' : 'text-text-400 hover:bg-bg-200 hover:text-text-100'}`}
        >
          {t('common:code')}
        </button>
      </div>
      {/* Content */}
      {mode === 'preview' ? (
        <ImagePreview dataUrl={dataUrl} fileName={fileName} />
      ) : (
        <div className="flex-1 min-h-0">
          <CodePreview code={text} language={language} isResizing={isResizing} />
        </div>
      )}
    </div>
  )
}

// ============================================
// Binary Placeholder - 不可预览的二进制文件
// ============================================

interface BinaryPlaceholderProps {
  mimeType: string
  fileName: string
  onDownload?: () => void
}

function BinaryPlaceholder({ mimeType, fileName, onDownload }: BinaryPlaceholderProps) {
  const { t } = useTranslation(['components', 'common'])

  return (
    <div className="flex flex-col items-center justify-center h-full text-text-400 text-xs gap-2 p-4">
      <img
        src={getMaterialIconUrl(fileName, 'file')}
        alt=""
        width={32}
        height={32}
        className="opacity-50"
        onError={e => {
          e.currentTarget.style.visibility = 'hidden'
        }}
      />
      <span className="font-medium text-text-300">{fileName}</span>
      <span>{formatMimeType(mimeType)}</span>
      <span className="text-text-500 text-[10px]">{t('components:fileExplorer.binaryFile')}</span>
      {onDownload && (
        <button
          onClick={onDownload}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-bg-200 hover:bg-bg-300 text-text-200 rounded transition-colors text-[11px]"
        >
          <DownloadIcon size={12} />
          {t('common:download')}
        </button>
      )}
    </div>
  )
}

// ============================================
// Diff Preview
// ============================================

interface DiffPreviewProps {
  hunks: Array<{
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    lines: string[]
  }>
  isResizing?: boolean
}

// 当前未在 Files 预览中使用，保留供 Changes 面板等复用
export function DiffPreview({ hunks, isResizing = false }: DiffPreviewProps) {
  return (
    <div
      className={`font-mono text-[11px] leading-relaxed ${isResizing ? 'whitespace-pre overflow-hidden' : ''}`}
      style={{ contain: 'content' }}
    >
      {hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx} className="border-b border-border-100/30 last:border-0">
          {/* Hunk Header */}
          <div className="px-3 py-1 bg-bg-200/50 text-text-400 text-[10px]">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>
          {/* Lines */}
          <div>
            {hunk.lines.map((line, lineIdx) => {
              const type = line[0]
              let bgClass = ''
              let textClass = 'text-text-300'

              if (type === '+') {
                bgClass = 'bg-success-100/10'
                textClass = 'text-success-100'
              } else if (type === '-') {
                bgClass = 'bg-danger-100/10'
                textClass = 'text-danger-100'
              }

              return (
                <div key={lineIdx} className={`px-3 py-0.5 ${bgClass} ${textClass}`}>
                  <span className="select-none opacity-50 w-4 inline-block">{type || ' '}</span>
                  <span>{line.slice(1)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
