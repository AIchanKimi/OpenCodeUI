import type {
  AgentPart as SDKAgentPart,
  ApiError as SDKApiError,
  AssistantMessage as SDKAssistantMessage,
  MessageAbortedError as SDKMessageAbortedError,
  MessageOutputLengthError as SDKMessageOutputLengthError,
  ProviderAuthError as SDKProviderAuthError,
  UnknownError as SDKUnknownError,
  UserMessage as SDKUserMessage,
} from '@opencode-ai/sdk/v2/client'

export interface TimeInfo {
  created: number
  updated?: number
  completed?: number
  archived?: number
  initialized?: number
}

export type TokenUsage = SDKAssistantMessage['tokens']

export type ModelRef = SDKUserMessage['model']

export type PathInfo = SDKAssistantMessage['path']

export interface ErrorInfo {
  name: string
  data: unknown
}

export type TextRange = NonNullable<SDKAgentPart['source']>

export interface BadRequestError {
  error: 'bad_request'
  message: string
}

export interface NotFoundError {
  error: 'not_found'
  message: string
}

export type ProviderAuthError = SDKProviderAuthError

export type UnknownError = SDKUnknownError

export type MessageOutputLengthError = SDKMessageOutputLengthError

export type MessageAbortedError = SDKMessageAbortedError

export type APIError = SDKApiError
