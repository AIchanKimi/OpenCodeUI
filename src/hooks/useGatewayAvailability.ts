import { useCallback, useEffect, useMemo, useState } from 'react'
import { probeGatewayAvailability, type GatewayAvailabilityStatus } from '../api/gateway'
import { useServerStore } from './useServerStore'

interface UseGatewayAvailabilityOptions {
  enabled?: boolean
}

interface GatewayAvailabilitySnapshot {
  status: GatewayAvailabilityStatus | 'checking'
  isAvailable: boolean
  isChecking: boolean
  refresh: () => Promise<void>
}

export function useGatewayAvailability(options: UseGatewayAvailabilityOptions = {}): GatewayAvailabilitySnapshot {
  const { enabled = true } = options
  const { activeServer } = useServerStore()
  const [status, setStatus] = useState<GatewayAvailabilityStatus | 'checking'>(enabled ? 'checking' : 'unavailable')

  const refresh = useCallback(async () => {
    if (!enabled) {
      setStatus('unavailable')
      return
    }

    setStatus('checking')
    const result = await probeGatewayAvailability()
    setStatus(result.status)
  }, [enabled])

  useEffect(() => {
    let disposed = false

    if (!enabled) {
      return
    }

    probeGatewayAvailability().then(result => {
      if (!disposed) {
        setStatus(result.status)
      }
    })

    return () => {
      disposed = true
    }
  }, [enabled, activeServer?.id, activeServer?.url, activeServer?.auth?.username, activeServer?.auth?.password])

  const effectiveStatus = enabled ? status : 'unavailable'

  return useMemo(
    () => ({
      status: effectiveStatus,
      isAvailable: effectiveStatus === 'available',
      isChecking: effectiveStatus === 'checking',
      refresh,
    }),
    [effectiveStatus, refresh],
  )
}
