import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GatewayPanel } from './GatewayPanel'
import { layoutStore } from '../store/layoutStore'

const getGatewayRoutesMock = vi.hoisted(() => vi.fn())
const setGatewayPreviewPortMock = vi.hoisted(() => vi.fn())

vi.mock('../api/gateway', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/gateway')>()
  return {
    ...actual,
    getGatewayRoutes: getGatewayRoutesMock,
    setGatewayPreviewPort: setGatewayPreviewPortMock,
  }
})

describe('GatewayPanel', () => {
  beforeEach(() => {
    getGatewayRoutesMock.mockResolvedValue({
      routes: [
        { token: 'abc123', port: 4173, publicUrl: 'http://localhost:6658/p/abc123/', createdAt: 1 },
        { token: 'def456', port: 3000, publicUrl: 'http://localhost:6658/p/def456/', createdAt: 2 },
      ],
      previewPort: 4173,
      previewDomain: null,
    })
    setGatewayPreviewPortMock.mockResolvedValue({ ok: true, previewPort: 3000 })
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads and renders routes', async () => {
    render(<GatewayPanel />)

    await waitFor(() => {
      expect(screen.getByText('4173')).toBeInTheDocument()
      expect(screen.getByText('3000')).toBeInTheDocument()
      expect(screen.getByText('http://localhost:6658/p/abc123/')).toBeInTheDocument()
    })
  })

  it('uses location.origin when route.publicUrl is empty', async () => {
    getGatewayRoutesMock.mockResolvedValueOnce({
      routes: [{ token: 'xyz789', port: 4173, publicUrl: '', createdAt: 1 }],
      previewPort: null,
      previewDomain: null,
    })

    render(<GatewayPanel />)

    await waitFor(() => {
      const previewOrigin = new URL(window.location.origin)
      previewOrigin.port = '6659'
      expect(screen.getByText(`${previewOrigin.origin}/p/xyz789/`)).toBeInTheDocument()
    })
  })

  it('filters routes by token, port, or url', async () => {
    render(<GatewayPanel />)

    await waitFor(() => expect(screen.getByDisplayValue('')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText(/Filter gateway routes|筛选网关路由/), {
      target: { value: 'def456' },
    })

    expect(screen.queryByText('4173')).not.toBeInTheDocument()
    expect(screen.getByText('3000')).toBeInTheDocument()
  })

  it('switches preview port from the route list', async () => {
    render(<GatewayPanel />)

    await waitFor(() => expect(screen.getByText(/Preview active|当前预览/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Set preview for port 3000|将 3000 设为预览/ }))

    await waitFor(() => {
      expect(setGatewayPreviewPortMock).toHaveBeenCalledWith(3000)
      expect(screen.getByText(/Preview switched to :3000|预览已切换到 :3000/)).toBeInTheDocument()
    })
  })

  it('opens the route url in the web preview tab when clicking a route card', async () => {
    const openWebPreviewUrlSpy = vi.spyOn(layoutStore, 'openWebPreviewUrl')

    render(<GatewayPanel />)

    await waitFor(() => expect(screen.getByText('4173')).toBeInTheDocument())

    fireEvent.click(screen.getByText('http://localhost:6658/p/abc123/'))

    expect(openWebPreviewUrlSpy).toHaveBeenCalledWith('http://localhost:6658/p/abc123/', 'right')
  })

  it('supports opening a route card from the keyboard', async () => {
    const openWebPreviewUrlSpy = vi.spyOn(layoutStore, 'openWebPreviewUrl')

    render(<GatewayPanel />)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Open route 4173 in web preview|在网页预览中打开 4173 端口/ }),
      ).toBeInTheDocument(),
    )

    fireEvent.keyDown(
      screen.getByRole('button', { name: /Open route 4173 in web preview|在网页预览中打开 4173 端口/ }),
      {
        key: 'Enter',
      },
    )

    expect(openWebPreviewUrlSpy).toHaveBeenCalledWith('http://localhost:6658/p/abc123/', 'right')
  })

  it('does not open the web preview tab when clicking action buttons inside a route card', async () => {
    const openWebPreviewUrlSpy = vi.spyOn(layoutStore, 'openWebPreviewUrl')

    render(<GatewayPanel />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Set preview for port 3000|将 3000 设为预览/ })).toBeInTheDocument(),
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Set preview for port 3000|将 3000 设为预览/ }))
      fireEvent.click(screen.getAllByTitle(/Copy URL|复制链接/)[1])
      await Promise.resolve()
    })

    expect(openWebPreviewUrlSpy).not.toHaveBeenCalled()
  })

  it('shows an unauthorized state when gateway auth fails', async () => {
    getGatewayRoutesMock.mockRejectedValueOnce({ status: 401, message: 'Unauthorized' })

    render(<GatewayPanel />)

    await waitFor(() => {
      expect(screen.getByText(/Authentication required|需要认证/)).toBeInTheDocument()
    })
  })

  it('polls for refreshed routes', async () => {
    vi.useFakeTimers()

    render(<GatewayPanel />)

    await act(async () => {
      await Promise.resolve()
    })

    const initialCalls = getGatewayRoutesMock.mock.calls.length

    await act(async () => {
      vi.advanceTimersByTime(8000)
      await Promise.resolve()
    })

    expect(getGatewayRoutesMock.mock.calls.length).toBeGreaterThan(initialCalls)
  })
})
