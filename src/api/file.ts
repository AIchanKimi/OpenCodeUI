// ============================================
// File Search API Functions
// 基于 OpenAPI: /file, /find/file, /find/symbol 相关接口
// ============================================

import { get, getBinary } from './http'
import { formatPathForApi } from '../utils/directoryUtils'
import type { FileNode, FileContent, FileStatusItem, SymbolInfo } from './types'
import { serverStore } from '../store/serverStore'

const ROOT_DIRECTORY_CACHE_TTL_MS = 10_000

const rootDirectoryCache = new Map<string, { data: FileNode[]; expiresAt: number }>()
const rootDirectoryInflight = new Map<string, Promise<FileNode[]>>()

function isRootDirectoryPath(path: string): boolean {
  return path === '' || path === '.' || path === './'
}

function getRootDirectoryCacheKey(directory?: string): string {
  return `${serverStore.getActiveServerId()}::${formatPathForApi(directory) ?? ''}`
}

async function fetchDirectory(path: string, directory?: string): Promise<FileNode[]> {
  const isAbsolute = /^[a-zA-Z]:/.test(path) || path.startsWith('/')

  if (isAbsolute && !directory) {
    return get<FileNode[]>('/file', { directory: formatPathForApi(path), path: '' })
  }

  return get<FileNode[]>('/file', { path, directory: formatPathForApi(directory) })
}

/**
 * GET /find/file - 搜索文件或目录
 * @param query 搜索关键词
 * @param options.directory 工作目录（项目目录）
 * @param options.type 搜索类型：file 或 directory
 * @param options.limit 返回结果数量限制
 */
export async function searchFiles(
  query: string,
  options: {
    directory?: string
    type?: 'file' | 'directory'
    limit?: number
  } = {},
): Promise<string[]> {
  return get<string[]>('/find/file', {
    query,
    directory: formatPathForApi(options.directory),
    type: options.type,
    limit: options.limit,
  })
}

/**
 * GET /file - 列出目录内容
 * @param path 要列出的路径（相对于 directory）
 * @param directory 工作目录（项目目录）
 */
export async function listDirectory(path: string, directory?: string): Promise<FileNode[]> {
  if (!isRootDirectoryPath(path)) {
    return fetchDirectory(path, directory)
  }

  const key = getRootDirectoryCacheKey(directory)
  const now = Date.now()
  const cached = rootDirectoryCache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.data
  }

  const inflight = rootDirectoryInflight.get(key)
  if (inflight) {
    return inflight
  }

  const request = fetchDirectory(path === '' ? '.' : path, directory)
    .then(data => {
      rootDirectoryCache.set(key, { data, expiresAt: Date.now() + ROOT_DIRECTORY_CACHE_TTL_MS })
      return data
    })
    .finally(() => {
      rootDirectoryInflight.delete(key)
    })

  rootDirectoryInflight.set(key, request)
  return request
}

export async function prefetchRootDirectory(directory?: string): Promise<void> {
  await listDirectory('.', directory)
}

/**
 * GET /file/content - 读取文件内容
 * @param path 文件路径（相对于 directory）
 * @param directory 工作目录（项目目录）
 */
export async function getFileContent(path: string, directory?: string): Promise<FileContent> {
  return get<FileContent>('/file/content', {
    path,
    directory: formatPathForApi(directory),
  })
}

function getArchiveFileNameFromPath(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const name = normalizedPath.split('/').filter(Boolean).pop() || 'archive'
  return `${name}.zip`
}

function getFileNameFromPath(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalizedPath.split('/').filter(Boolean).pop() || 'download'
}

function parseContentDispositionFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return fileNameMatch?.[1] ?? null
}

export async function downloadDirectoryArchive(
  path: string,
  directory?: string,
  options: { signal?: AbortSignal; timeout?: number } = {},
): Promise<{ blob: Blob; fileName: string }> {
  const response = await getBinary(
    '/file/archive',
    {
      path,
      directory: formatPathForApi(directory),
    },
    { signal: options.signal, timeout: options.timeout ?? 0 },
  )

  return {
    blob: await response.blob(),
    fileName:
      parseContentDispositionFileName(response.headers.get('Content-Disposition')) || getArchiveFileNameFromPath(path),
  }
}

export async function downloadFileAsset(
  path: string,
  directory?: string,
  options: { signal?: AbortSignal; timeout?: number } = {},
): Promise<{ blob: Blob; fileName: string }> {
  const response = await getBinary(
    '/file/download',
    {
      path,
      directory: formatPathForApi(directory),
    },
    { signal: options.signal, timeout: options.timeout ?? 0 },
  )

  return {
    blob: await response.blob(),
    fileName: parseContentDispositionFileName(response.headers.get('Content-Disposition')) || getFileNameFromPath(path),
  }
}

/**
 * GET /file/status - 获取文件 git 状态
 * @param directory 工作目录（项目目录）
 */
export async function getFileStatus(directory?: string): Promise<FileStatusItem[]> {
  return get<FileStatusItem[]>('/file/status', {
    directory: formatPathForApi(directory),
  })
}

/**
 * GET /find/symbol - 搜索代码符号
 * @param query 搜索关键词
 * @param directory 工作目录（项目目录）
 */
export async function searchSymbols(query: string, directory?: string): Promise<SymbolInfo[]> {
  return get<SymbolInfo[]>('/find/symbol', { query, directory: formatPathForApi(directory) })
}

/**
 * 搜索目录（便捷方法）
 * @param query 搜索关键词
 * @param baseDirectory 基础目录（从哪里开始搜索）
 * @param limit 返回结果数量限制
 */
export async function searchDirectories(query: string, baseDirectory?: string, limit: number = 50): Promise<string[]> {
  return searchFiles(query, {
    directory: baseDirectory,
    type: 'directory',
    limit,
  })
}
