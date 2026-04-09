// ============================================
// Message API Functions
// 基于 @opencode-ai/sdk: /session/{sessionID}/message 相关接口
// ============================================

import { getSDKClient, unwrap } from './sdk'
import { formatPathForApi } from '../utils/directoryUtils'
import type {
  ApiMessageWithParts,
  ApiTextPart,
  ApiFilePart,
  ApiAgentPart,
  Attachment,
  RevertedMessage,
  SendMessageParams,
  SendMessageResponse,
} from './types'

// ============================================
// Message Query
// ============================================

/**
 * 获取 session 的消息列表
 */
export async function getSessionMessages(
  sessionId: string,
  limit?: number,
  directory?: string,
): Promise<ApiMessageWithParts[]> {
  const sdk = getSDKClient()
  return unwrap(
    await sdk.session.messages({
      sessionID: sessionId,
      directory: formatPathForApi(directory),
      limit,
    }),
  ) as ApiMessageWithParts[]
}

/**
 * 获取 session 的消息数量
 */
export async function getSessionMessageCount(sessionId: string): Promise<number> {
  const messages = await getSessionMessages(sessionId)
  return messages.length
}

// ============================================
// Message Content Extraction
// ============================================

/**
 * 从 API 消息中提取用户消息内容（文本+附件）
 */
export function extractUserMessageContent(apiMessage: ApiMessageWithParts): RevertedMessage {
  const { parts } = apiMessage

  const textParts = parts.filter((p): p is ApiTextPart => p.type === 'text' && !p.synthetic)
  const text = textParts.map(p => p.text).join('\n')

  const attachments: Attachment[] = []

  const getSourcePath = (source: ApiFilePart['source']): string | undefined => {
    if (!source || !('path' in source)) return undefined
    return source.path
  }

  for (const part of parts) {
    if (part.type === 'file') {
      const fp = part as ApiFilePart
      const isFolder = fp.mime === 'application/x-directory'
      const sourcePath = getSourcePath(fp.source)
      attachments.push({
        id: fp.id || crypto.randomUUID(),
        type: isFolder ? 'folder' : 'file',
        displayName: fp.filename || sourcePath || 'file',
        url: fp.url,
        mime: fp.mime,
        relativePath: sourcePath,
        textRange: fp.source?.text
          ? {
              value: fp.source.text.value,
              start: fp.source.text.start,
              end: fp.source.text.end,
            }
          : undefined,
      })
    } else if (part.type === 'agent') {
      const ap = part as ApiAgentPart
      attachments.push({
        id: ap.id || crypto.randomUUID(),
        type: 'agent',
        displayName: ap.name,
        agentName: ap.name,
        textRange: ap.source
          ? {
              value: ap.source.value,
              start: ap.source.start,
              end: ap.source.end,
            }
          : undefined,
      })
    }
  }

  return { text, attachments }
}

// ============================================
// Send Message
// ============================================

/**
 * 构建 file:// URL
 */
function toFileUrl(path: string): string {
  if (!path) return ''

  if (path.startsWith('file://')) {
    return path
  }

  if (path.startsWith('data:')) {
    return path
  }

  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) {
    return `file:///${normalized}`
  }
  if (normalized.startsWith('/')) {
    return `file://${normalized}`
  }
  return `file:///${normalized}`
}

/**
 * 构建 SDK 发送消息所需的参数
 */
function buildPromptParams(params: SendMessageParams) {
  const { sessionId, text, attachments, model, agent, variant, directory } = params

  const parts: Array<{ type: string; [key: string]: unknown }> = []

  // 文本 part
  parts.push({
    type: 'text',
    text,
  })

  // 附件 parts
  for (const attachment of attachments) {
    if (attachment.type === 'agent') {
      parts.push({
        type: 'agent',
        name: attachment.agentName,
        source: attachment.textRange
          ? {
              value: attachment.textRange.value,
              start: attachment.textRange.start,
              end: attachment.textRange.end,
            }
          : undefined,
      })
    } else {
      const fileUrl = toFileUrl(attachment.url || '')
      if (!fileUrl) {
        console.warn('Skipping attachment with empty URL:', attachment)
        continue
      }

      parts.push({
        type: 'file',
        mime: attachment.mime || (attachment.type === 'folder' ? 'application/x-directory' : 'text/plain'),
        url: fileUrl,
        filename: attachment.displayName,
        source: attachment.textRange
          ? {
              text: {
                value: attachment.textRange.value,
                start: attachment.textRange.start,
                end: attachment.textRange.end,
              },
              type: 'file',
              path: attachment.relativePath || attachment.displayName,
            }
          : undefined,
      })
    }
  }

  return {
    sessionID: sessionId,
    directory: formatPathForApi(directory),
    parts: parts as Parameters<ReturnType<typeof getSDKClient>['session']['promptAsync']>[0]['parts'],
    model,
    agent,
    variant,
  }
}

/**
 * 同步发送消息（等待完成）
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
  const sdk = getSDKClient()
  return unwrap(await sdk.session.prompt(buildPromptParams(params))) as SendMessageResponse
}

/**
 * 异步发送消息 — 立即返回，AI 响应通过 SSE 推送
 */
export async function sendMessageAsync(params: SendMessageParams): Promise<void> {
  const sdk = getSDKClient()
  await sdk.session.promptAsync(buildPromptParams(params))
}
