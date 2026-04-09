import type {
  McpResource as SDKMcpResource,
  McpStatus as SDKMcpStatus,
  McpStatusConnected as SDKMcpStatusConnected,
  McpStatusDisabled as SDKMcpStatusDisabled,
  McpStatusFailed as SDKMcpStatusFailed,
  McpStatusNeedsAuth as SDKMcpStatusNeedsAuth,
  McpStatusNeedsClientRegistration as SDKMcpStatusNeedsClientRegistration,
} from '@opencode-ai/sdk/v2/client'

export type MCPStatusConnected = SDKMcpStatusConnected

export type MCPStatusDisabled = SDKMcpStatusDisabled

export type MCPStatusFailed = SDKMcpStatusFailed

export type MCPStatusNeedsAuth = SDKMcpStatusNeedsAuth

export type MCPStatusNeedsClientRegistration = SDKMcpStatusNeedsClientRegistration

export type MCPStatus = SDKMcpStatus

export type MCPResource = SDKMcpResource

export interface MCPStatusResponse {
  [serverName: string]: MCPStatus
}

export interface McpLocalConfig {
  type: 'local'
  command: string[]
  environment?: Record<string, string>
  enabled?: boolean
  timeout?: number
}

export interface McpOAuthConfig {
  clientId?: string
  clientSecret?: string
  scope?: string
}

export interface McpRemoteConfig {
  type: 'remote'
  url: string
  enabled?: boolean
  headers?: Record<string, string>
  oauth?: McpOAuthConfig | false
  timeout?: number
}

export type McpServerConfig = McpLocalConfig | McpRemoteConfig
