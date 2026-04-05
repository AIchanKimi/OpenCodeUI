import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircleIcon, CopyIcon, EyeIcon, LinkIcon, RetryIcon, SearchIcon, ShieldIcon, SpinnerIcon } from './Icons'
import { GATEWAY_PREVIEW_BASE_URL, GATEWAY_PREVIEW_PORT } from '../constants'
import {
  getGatewayErrorStatus,
  getGatewayRoutes,
  setGatewayPreviewPort,
  type GatewayRoute,
  type GatewayRoutesResponse,
} from '../api/gateway'

interface GatewayPanelProps {
  isResizing?: boolean
}

type LoadState = 'idle' | 'loading' | 'ready' | 'unauthorized' | 'unavailable' | 'error'

function formatRelativeTime(createdAt: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - createdAt))
  if (seconds < 60) return t('gatewayPanel.justNow')
  if (seconds < 3600) return t('gatewayPanel.minutesAgo', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('gatewayPanel.hoursAgo', { count: Math.floor(seconds / 3600) })
  return t('gatewayPanel.daysAgo', { count: Math.floor(seconds / 86400) })
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function getPreviewBaseUrl(): string | null {
  const configuredBaseUrl = normalizeBaseUrl(GATEWAY_PREVIEW_BASE_URL)
  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  if (typeof window === 'undefined') {
    return null
  }

  if (!window.location.origin || window.location.origin === 'null') {
    return null
  }

  try {
    const previewUrl = new URL(window.location.origin)
    previewUrl.port = GATEWAY_PREVIEW_PORT
    return normalizeBaseUrl(previewUrl.origin)
  } catch {
    return null
  }
}

function getRouteUrl(route: GatewayRoute, previewDomain: string | null): string {
  if (route.publicUrl) return route.publicUrl
  if (previewDomain) return `https://${previewDomain}/p/${route.token}/`
  const previewBaseUrl = getPreviewBaseUrl()
  if (previewBaseUrl) {
    return `${previewBaseUrl}/p/${route.token}/`
  }
  return `/p/${route.token}/`
}

export const GatewayPanel = memo(function GatewayPanel({ isResizing: _isResizing = false }: GatewayPanelProps) {
  const { t } = useTranslation(['components', 'common'])
  const [data, setData] = useState<GatewayRoutesResponse>({ routes: [], previewPort: null, previewDomain: null })
  const [filter, setFilter] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionLoadingPort, setActionLoadingPort] = useState<number | null>(null)

  const loadRoutes = useCallback(async () => {
    try {
      setErrorMessage(null)
      setLoadState(current => (current === 'ready' ? current : 'loading'))
      const nextData = await getGatewayRoutes()
      setData(nextData)
      setLoadState('ready')
    } catch (error) {
      const status = getGatewayErrorStatus(error)
      setLoadState(status === 'available' ? 'ready' : status)
      setErrorMessage(error instanceof Error ? error.message : null)
    }
  }, [])

  useEffect(() => {
    void loadRoutes()
  }, [loadRoutes])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadRoutes()
    }, 8000)

    return () => window.clearInterval(timer)
  }, [loadRoutes])

  const filteredRoutes = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return data.routes

    return data.routes.filter(route => {
      const url = getRouteUrl(route, data.previewDomain).toLowerCase()
      return route.token.toLowerCase().includes(query) || String(route.port).includes(query) || url.includes(query)
    })
  }, [data.previewDomain, data.routes, filter])

  const setPreview = useCallback(
    async (port: number | null) => {
      setActionLoadingPort(port)
      try {
        const result = await setGatewayPreviewPort(port)
        const nextPreviewPort = result.previewPort
        setData(current => ({
          ...current,
          previewPort: nextPreviewPort,
        }))
        setFeedback(
          nextPreviewPort === null
            ? t('gatewayPanel.previewStopped')
            : t('gatewayPanel.previewUpdated', { port: nextPreviewPort }),
        )
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : t('gatewayPanel.failedToLoad'))
      } finally {
        setActionLoadingPort(null)
      }
    },
    [t],
  )

  const copyText = useCallback(
    async (text: string, message: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setFeedback(message)
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : t('gatewayPanel.copyFailed'))
      }
    },
    [t],
  )

  const errorBody = useMemo(() => {
    switch (loadState) {
      case 'unauthorized':
        return {
          title: t('gatewayPanel.unauthorized'),
          hint: t('gatewayPanel.unauthorizedHint'),
          icon: <ShieldIcon size={18} className="text-warning-100" />,
        }
      case 'unavailable':
        return {
          title: t('gatewayPanel.unavailable'),
          hint: t('gatewayPanel.unavailableHint'),
          icon: <AlertCircleIcon size={18} className="text-danger-100" />,
        }
      case 'error':
        return {
          title: t('gatewayPanel.failedToLoad'),
          hint: errorMessage ?? t('gatewayPanel.failedToLoad'),
          icon: <AlertCircleIcon size={18} className="text-danger-100" />,
        }
      default:
        return null
    }
  }, [errorMessage, loadState, t])

  return (
    <div className="flex flex-col h-full bg-bg-100">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-100">
        <div className="flex items-center gap-2 text-text-100 text-sm font-medium min-w-0">
          <LinkIcon size={14} />
          <span>{t('gatewayPanel.title')}</span>
          {loadState === 'ready' && (
            <span className="text-text-400 text-xs">
              ({t('gatewayPanel.activeCount', { count: data.routes.length })})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              void copyText(
                data.routes.map(route => getRouteUrl(route, data.previewDomain)).join('\n'),
                t('gatewayPanel.copiedAll'),
              )
            }
            disabled={data.routes.length === 0}
            className="p-1 hover:bg-bg-200 rounded text-text-300 hover:text-text-100 transition-colors disabled:opacity-40"
            title={t('gatewayPanel.copyAll')}
          >
            <CopyIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => void loadRoutes()}
            className="p-1 hover:bg-bg-200 rounded text-text-300 hover:text-text-100 transition-colors"
            title={t('common:refresh')}
          >
            <RetryIcon size={14} className={loadState === 'loading' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {data.previewPort !== null && (
        <div className="px-3 py-2 border-b border-border-100 bg-bg-000/40 flex items-center justify-between gap-2 text-xs text-text-200">
          <div className="flex items-center gap-2 min-w-0">
            <EyeIcon size={14} className="text-accent-main-100 shrink-0" />
            <span className="truncate">
              {t('gatewayPanel.previewActive')}: :{data.previewPort}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void setPreview(null)}
            className="px-2 py-1 rounded-md bg-bg-200/70 hover:bg-bg-200 text-text-100 transition-colors"
            aria-label={t('gatewayPanel.stopPreviewAria')}
          >
            {t('gatewayPanel.stopPreview')}
          </button>
        </div>
      )}

      <div className="px-3 py-2 border-b border-border-100">
        <label className="relative block">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-400" />
          <input
            type="text"
            value={filter}
            onChange={event => setFilter(event.target.value)}
            placeholder={t('gatewayPanel.filterPlaceholder')}
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border-200 bg-bg-000 text-sm text-text-100 placeholder:text-text-400 focus:outline-none focus:border-accent-main-100/50"
          />
        </label>
      </div>

      {feedback && <div className="px-3 py-2 text-xs text-text-300 border-b border-border-100">{feedback}</div>}

      <div className="flex-1 overflow-auto px-3 py-3">
        {loadState === 'loading' && data.routes.length === 0 && (
          <div
            className="flex items-center justify-center h-full text-text-400 text-sm gap-2"
            data-testid="loading-spinner"
          >
            <SpinnerIcon size={16} className="animate-spin" />
            <span>{t('gatewayPanel.loadingRoutes')}</span>
          </div>
        )}

        {errorBody && data.routes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
            {errorBody.icon}
            <div className="text-sm text-text-100">{errorBody.title}</div>
            <div className="text-xs text-text-400">{errorBody.hint}</div>
          </div>
        )}

        {loadState === 'ready' && data.routes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
            <LinkIcon size={18} className="text-text-400" />
            <div className="text-sm text-text-100">{t('gatewayPanel.noRoutes')}</div>
            <div className="text-xs text-text-400">{t('gatewayPanel.noRoutesHint')}</div>
          </div>
        )}

        {loadState === 'ready' && data.routes.length > 0 && filteredRoutes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
            <SearchIcon size={18} className="text-text-400" />
            <div className="text-sm text-text-100">{t('gatewayPanel.noMatches')}</div>
          </div>
        )}

        {filteredRoutes.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredRoutes.map(route => {
              const url = getRouteUrl(route, data.previewDomain)
              const isPreviewing = data.previewPort === route.port
              return (
                <div
                  key={route.token}
                  className={`rounded-lg border px-3 py-3 bg-bg-000 transition-colors ${
                    isPreviewing ? 'border-accent-main-100/40 bg-accent-main-100/5' : 'border-border-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-md bg-bg-200 px-2 py-0.5 text-xs font-medium text-text-100">
                      {route.port}
                    </span>
                    <span className="text-xs text-text-400">{formatRelativeTime(route.createdAt, t)}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void setPreview(isPreviewing ? null : route.port)}
                        disabled={actionLoadingPort === route.port}
                        className={`p-1 rounded transition-colors ${
                          isPreviewing
                            ? 'text-accent-main-100 bg-accent-main-100/10'
                            : 'text-text-300 hover:text-text-100 hover:bg-bg-200'
                        } disabled:opacity-50`}
                        aria-label={
                          isPreviewing
                            ? t('gatewayPanel.stopPreviewForPort', { port: route.port })
                            : t('gatewayPanel.setPreview', { port: route.port })
                        }
                      >
                        <EyeIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyText(url, t('gatewayPanel.copied'))}
                        className="p-1 rounded text-text-300 hover:text-text-100 hover:bg-bg-200 transition-colors"
                        title={t('gatewayPanel.copyUrl')}
                      >
                        <CopyIcon size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-text-200 font-mono break-all">{url}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})
