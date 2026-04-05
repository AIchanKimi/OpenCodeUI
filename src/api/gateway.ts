import { GATEWAY_BASE_URL } from '../constants'
import { getAuthHeader, unifiedFetch } from './http'

let lastWorkingGatewayBaseUrl: string | null = null

export interface GatewayRoute {
  token: string
  port: number
  publicUrl: string
  createdAt: number
}

export interface GatewayRoutesResponse {
  routes: GatewayRoute[]
  previewPort: number | null
  previewDomain: string | null
}

export interface GatewayPreviewStatus {
  previewPort: number | null
  previewDomain: string | null
}

export interface GatewayPreviewSetResponse {
  ok: boolean
  previewPort: number | null
}

export type GatewayAvailabilityStatus = 'available' | 'unavailable' | 'unauthorized' | 'error'

export interface GatewayAvailabilityResult {
  status: GatewayAvailabilityStatus
  error?: string
}

export class GatewayApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GatewayApiError'
    this.status = status
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function getConfiguredGatewayBaseUrl(): string | null {
  const configured = normalizeBaseUrl(GATEWAY_BASE_URL)
  return configured ? configured : null
}

function getWindowOriginBaseUrl(): string | null {
  if (typeof window === 'undefined') return null
  if (!window.location.origin || window.location.origin === 'null') return null
  if (!/^https?:$/i.test(window.location.protocol)) return null
  return normalizeBaseUrl(window.location.origin)
}

function getGatewayBaseCandidates(): string[] {
  const candidates = [lastWorkingGatewayBaseUrl, getConfiguredGatewayBaseUrl(), getWindowOriginBaseUrl()].filter(
    (value): value is string => Boolean(value),
  )

  return [...new Set(candidates)]
}

async function gatewayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init.headers as Record<string, string> | undefined),
  }

  let bestError: GatewayApiError | null = null

  for (const baseUrl of getGatewayBaseCandidates()) {
    let response: Response
    try {
      response = await unifiedFetch(`${baseUrl}${path}`, {
        ...init,
        method: init.method ?? 'GET',
        headers,
      })
    } catch (error) {
      if (!bestError) {
        bestError = new GatewayApiError(0, error instanceof Error ? error.message : 'Gateway request failed')
      }
      continue
    }

    if (!response.ok) {
      let message = `Gateway request failed: ${response.status}`
      try {
        const text = await response.text()
        if (text) {
          message = text
        }
      } catch {
        // ignore read errors
      }

      const error = new GatewayApiError(response.status, message)
      if (response.status === 401) {
        lastWorkingGatewayBaseUrl = baseUrl
        throw error
      }

      if (response.status !== 404 && (!bestError || bestError.status === 0 || bestError.status === 404)) {
        bestError = error
      } else if (!bestError) {
        bestError = error
      }
      continue
    }

    lastWorkingGatewayBaseUrl = baseUrl

    if (response.status === 204) {
      return undefined as T
    }

    const text = await response.text()
    return text ? (JSON.parse(text) as T) : (undefined as T)
  }

  throw bestError ?? new GatewayApiError(404, 'Gateway request failed: 404')
}

export async function getGatewayRoutes(): Promise<GatewayRoutesResponse> {
  return gatewayRequest<GatewayRoutesResponse>('/routes?format=json', {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function getGatewayPreviewStatus(): Promise<GatewayPreviewStatus> {
  return gatewayRequest<GatewayPreviewStatus>('/preview/status', {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function setGatewayPreviewPort(port: number | null): Promise<GatewayPreviewSetResponse> {
  return gatewayRequest<GatewayPreviewSetResponse>('/preview/set', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ port }),
  })
}

export function getGatewayErrorStatus(error: unknown): GatewayAvailabilityStatus {
  if (error instanceof GatewayApiError) {
    if (error.status === 401) return 'unauthorized'
    if (error.status === 404) return 'unavailable'
    return 'error'
  }

  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status?: unknown }).status)
    if (status === 401) return 'unauthorized'
    if (status === 404) return 'unavailable'
  }

  if (error instanceof TypeError) {
    return 'unavailable'
  }

  return 'error'
}

export async function probeGatewayAvailability(): Promise<GatewayAvailabilityResult> {
  try {
    await getGatewayRoutes()
    return { status: 'available' }
  } catch (error) {
    return {
      status: getGatewayErrorStatus(error),
      error: error instanceof Error ? error.message : 'Unknown gateway error',
    }
  }
}
