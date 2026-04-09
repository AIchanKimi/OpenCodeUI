import type { Agent as SDKAgent } from '@opencode-ai/sdk/v2/client'

export type AgentMode = SDKAgent['mode']

export interface AgentPermission {
  permission: string
  action: 'allow' | 'ask' | 'deny'
  pattern: string
}

export type Agent = Omit<SDKAgent, 'permission'> & {
  permission?: AgentPermission[]
}
