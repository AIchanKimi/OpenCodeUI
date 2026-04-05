import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../store/serverStore', () => ({
  serverStore: {
    getActiveAuth: () => null,
  },
  makeBasicAuthHeader: () => '',
}))

vi.mock('../utils/tauri', () => ({ isTauri: () => false }))

describe('gateway api', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads routes payload from the gateway router api', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [{ token: 'abc123', port: 4173, publicUrl: 'http://localhost:6658/p/abc123/', createdAt: 1 }],
          previewPort: 4173,
          previewDomain: null,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof globalThis.fetch

    const { getGatewayRoutes } = await import('./gateway')
    const result = await getGatewayRoutes()

    expect(result.routes).toHaveLength(1)
    expect(result.previewPort).toBe(4173)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${window.location.origin}/routes?format=json`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('classifies 401 responses as unauthorized when probing availability', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('Unauthorized', { status: 401 })) as unknown as typeof globalThis.fetch

    const { probeGatewayAvailability } = await import('./gateway')
    await expect(probeGatewayAvailability()).resolves.toMatchObject({ status: 'unauthorized' })
  })

  it('classifies 404 responses as unavailable when probing availability', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('Not Found', { status: 404 })) as unknown as typeof globalThis.fetch

    const { probeGatewayAvailability } = await import('./gateway')
    await expect(probeGatewayAvailability()).resolves.toMatchObject({ status: 'unavailable' })
  })

  it('uses same-origin routes by default', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          routes: [{ token: 'abc123', port: 4173, publicUrl: 'http://localhost:6658/p/abc123/', createdAt: 1 }],
          previewPort: 4173,
          previewDomain: null,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof globalThis.fetch

    const { getGatewayRoutes } = await import('./gateway')
    const result = await getGatewayRoutes()

    expect(result.previewPort).toBe(4173)
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      `${window.location.origin}/routes?format=json`,
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
