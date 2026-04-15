/** API 基础地址 - 优先使用环境变量，其次使用同源 /api 前缀（Docker 部署），回退到本地开发地址 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4096'

/**
 * Gateway 基础地址。
 * - 优先使用显式环境变量
 * - 否则由运行页面的 host 推导到 gateway 默认端口 6658
 * - 如果当前页面本身就是通过 gateway 打开的，则直接复用当前 origin
 */
export const GATEWAY_BASE_URL = import.meta.env.VITE_GATEWAY_BASE_URL || ''

/**
 * Gateway 预览基址。
 * - 优先使用显式环境变量
 * - 否则在前端按当前 host 推导到预览端口
 */
export const GATEWAY_PREVIEW_BASE_URL = import.meta.env.VITE_GATEWAY_PREVIEW_BASE_URL || ''

/** Gateway 预览端口，默认与 docker compose 的 PREVIEW_PORT 保持一致。 */
export const GATEWAY_PREVIEW_PORT = import.meta.env.VITE_GATEWAY_PREVIEW_PORT || '6659'

/** SSE 重连延迟序列（毫秒） */
export const SSE_RECONNECT_DELAYS_MS = [1000, 2000, 3000, 5000, 10000, 30000]

/** SSE 心跳超时 */
export const SSE_HEARTBEAT_TIMEOUT_MS = 60000
