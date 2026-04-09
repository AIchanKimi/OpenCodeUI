import type {
  PermissionRequest as SDKPermissionRequest,
  QuestionAnswer as SDKQuestionAnswer,
  QuestionInfo as SDKQuestionInfo,
  QuestionOption as SDKQuestionOption,
  QuestionRequest as SDKQuestionRequest,
} from '@opencode-ai/sdk/v2/client'

export type PermissionAction = 'allow' | 'ask' | 'deny'

export interface PermissionRule {
  permission: string
  action: PermissionAction
  pattern: string
}

export interface PermissionRuleset {
  rules: PermissionRule[]
}

export type PermissionToolInfo = NonNullable<SDKPermissionRequest['tool']>

export type PermissionRequest = SDKPermissionRequest

export type PermissionReply = 'once' | 'always' | 'reject'

export type QuestionOption = SDKQuestionOption

export type QuestionInfo = SDKQuestionInfo

export type QuestionRequest = SDKQuestionRequest

export type QuestionAnswer = SDKQuestionAnswer
