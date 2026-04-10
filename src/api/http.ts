// ============================================
// HTTP Utilities
// 为 SSE / PTY 以及 file-service 兼容层提供统一 URL、auth 与请求辅助函数
// ============================================

import { serverStore, makeBasicAuthHeader } from '../store/serverStore'
import { isTauri } from '../utils/tauri'

let tauriFetchPromise: Promise<typeof globalThis.fetch> | null = null

export async function unifiedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!isTauri()) {
    return globalThis.fetch(input, init)
  }

  if (!tauriFetchPromise) {
    tauriFetchPromise = import('@tauri-apps/plugin-http').then(mod => mod.fetch as unknown as typeof globalThis.fetch)
  }

  const tauriFetch = await tauriFetchPromise
  return tauriFetch(input, init)
}

/**
 * 获取当前 API Base URL
 * 优先使用 serverStore 中的活动服务器，回退到常量
 */
export function getApiBaseUrl(): string {
  return serverStore.getActiveBaseUrl()
}

/**
 * 获取当前活动服务器的 Authorization header
 * 如果服务器配置了密码则返回 Basic Auth header，否则返回 undefined
 */
export function getAuthHeader(): Record<string, string> {
  const auth = serverStore.getActiveAuth()
  if (auth?.password) {
    return { Authorization: makeBasicAuthHeader(auth) }
  }
  return {}
}

type QueryValue = string | number | boolean | undefined

/**
 * 构建查询字符串
 * 值会进行 URL 编码以安全处理空格、特殊字符等
 * （Go 后端的 r.URL.Query().Get() 会自动解码）
 */
export function buildQueryString(params: Record<string, QueryValue>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }
  return parts.length > 0 ? '?' + parts.join('&') : ''
}

/**
 * 构建完整 URL
 */
export function buildUrl(path: string, params: Record<string, QueryValue> = {}): string {
  return `${getApiBaseUrl()}${path}${buildQueryString(params)}`
}

// ============================================
// HTTP Methods
// ============================================

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  /** 请求超时（毫秒），默认 30000。传 0 表示不超时 */
  timeout?: number
  /** 外部传入的 AbortSignal，与 timeout 取先到者 */
  signal?: AbortSignal
}

const DEFAULT_TIMEOUT = 30_000

async function requestResponse(
  path: string,
  params: Record<string, QueryValue> = {},
  options: RequestOptions = {},
): Promise<Response> {
  const { method = 'GET', body, headers = {}, timeout = DEFAULT_TIMEOUT, signal } = options

  const requestHeaders: Record<string, string> = {
    ...getAuthHeader(),
    ...headers,
  }

  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  if (timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeout}ms`)), timeout)
  }

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
    }
  }

  const init: RequestInit = {
    method,
    headers: requestHeaders,
    signal: controller.signal,
  }

  if (body !== undefined) {
    init.headers = {
      ...init.headers,
      'Content-Type': 'application/json',
    }
    init.body = JSON.stringify(body)
  }

  try {
    const response = await unifiedFetch(buildUrl(path, params), init)

    if (!response.ok) {
      let errorMsg = `Request failed: ${response.status}`
      try {
        const errorText = await response.text()
        if (errorText) {
          errorMsg += ` - ${errorText}`
        }
      } catch {
        // ignore
      }
      throw new Error(errorMsg)
    }

    return response
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

/**
 * 通用 HTTP 请求函数
 *
 * 如果活动服务器配置了密码，会自动添加 Authorization header
 * 注意：跨域场景下 Authorization header 会触发 CORS 预检请求，
 * 需要后端正确处理 OPTIONS 请求
 */
export async function request<T>(
  path: string,
  params: Record<string, QueryValue> = {},
  options: RequestOptions = {},
): Promise<T> {
  const response = await requestResponse(path, params, options)

  // 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text)
}

export async function requestBinary(
  path: string,
  params: Record<string, QueryValue> = {},
  options: RequestOptions = {},
): Promise<Response> {
  return requestResponse(path, params, options)
}

/**
 * GET 请求
 */
export async function get<T>(path: string, params: Record<string, QueryValue> = {}): Promise<T> {
  return request<T>(path, params, { method: 'GET' })
}

export async function getBinary(
  path: string,
  params: Record<string, QueryValue> = {},
  options: RequestOptions = {},
): Promise<Response> {
  return requestBinary(path, params, { ...options, method: 'GET' })
}

/**
 * POST 请求
 */
export async function post<T>(path: string, params: Record<string, QueryValue> = {}, body?: unknown): Promise<T> {
  return request<T>(path, params, { method: 'POST', body })
}

/**
 * PATCH 请求
 */
export async function patch<T>(path: string, params: Record<string, QueryValue> = {}, body?: unknown): Promise<T> {
  return request<T>(path, params, { method: 'PATCH', body })
}

/**
 * PUT 请求
 */
export async function put<T>(path: string, params: Record<string, QueryValue> = {}, body?: unknown): Promise<T> {
  return request<T>(path, params, { method: 'PUT', body })
}

/**
 * DELETE 请求
 */
export async function del<T>(path: string, params: Record<string, QueryValue> = {}, body?: unknown): Promise<T> {
  return request<T>(path, params, { method: 'DELETE', body })
}
