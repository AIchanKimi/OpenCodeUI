import type {
  File as SDKFile,
  FileContent as SDKFileContent,
  FileNode as SDKFileNode,
  SnapshotFileDiff as SDKSnapshotFileDiff,
  Symbol as SDKSymbol,
} from '@opencode-ai/sdk/v2/client'

export type FileNodeType = SDKFileNode['type']

export type FileNode = SDKFileNode

export type FilePatch = NonNullable<SDKFileContent['patch']>

export type PatchHunk = FilePatch['hunks'][number]

export type FileContent = SDKFileContent

export type FileStatusItem = SDKFile

export type FileDiff = SDKSnapshotFileDiff & {
  before?: string
  after?: string
}

export type SymbolRange = SDKSymbol['location']['range']

export type SymbolLocation = SDKSymbol['location']

export interface FileWriteRequest {
  content: string
  expectedContent?: string
}

export interface FileWriteResponse {
  path: string
  savedAt: string
}

/**
 * 文件状态 (旧版兼容)
 */
export interface FileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied'
  staged: boolean
}
export type Symbol = SDKSymbol
