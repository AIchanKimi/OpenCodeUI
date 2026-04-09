import type { Pty as SDKPty } from '@opencode-ai/sdk/v2/client'

export interface PtySize {
  rows: number
  cols: number
}

export type Pty = SDKPty & {
  env?: Record<string, string>
  size?: PtySize
  running: boolean
  exitCode?: number
}

export interface PtyCreateParams {
  command?: string
  args?: string[]
  cwd?: string
  title?: string
  env?: Record<string, string>
}

export interface PtyUpdateParams {
  title?: string
  size?: PtySize
}
