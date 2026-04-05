import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const gatewayAvailabilityMock = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useGatewayAvailability', () => ({
  useGatewayAvailability: gatewayAvailabilityMock,
}))

import { PanelContainer } from './PanelContainer'
import { layoutStore } from '../store/layoutStore'

function resetLayoutStore() {
  const state = layoutStore.getState()
  state.panelTabs.splice(0, state.panelTabs.length, {
    id: 'files',
    type: 'files',
    position: 'right',
    previewFile: null,
    previewFiles: [],
  })
  state.activeTabId.bottom = null
  state.activeTabId.right = 'files'
  state.bottomPanelOpen = false
  state.rightPanelOpen = true
  state.bottomPanelHeight = 250
  state.rightPanelWidth = 450
}

describe('PanelContainer', () => {
  beforeEach(() => {
    resetLayoutStore()
    gatewayAvailabilityMock.mockReturnValue({
      status: 'unavailable',
      isAvailable: false,
      isChecking: false,
      refresh: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    resetLayoutStore()
    vi.restoreAllMocks()
  })

  it('adds a web preview tab from the add menu', () => {
    render(
      <PanelContainer position="right" onNewTerminal={vi.fn()}>
        {activeTab => <div>{activeTab?.id}</div>}
      </PanelContainer>,
    )

    fireEvent.click(screen.getByTitle(/Add Tab|添加标签/))
    fireEvent.click(screen.getByText(/Web Preview|网页预览/))

    expect(layoutStore.getState().panelTabs.some(tab => tab.type === 'web-preview')).toBe(true)
    expect(layoutStore.getActiveTab('right')?.type).toBe('web-preview')
  })

  it('hides gateway from the add menu when gateway is unavailable', () => {
    render(
      <PanelContainer position="right" onNewTerminal={vi.fn()}>
        {activeTab => <div>{activeTab?.id}</div>}
      </PanelContainer>,
    )

    fireEvent.click(screen.getByTitle(/Add Tab|添加标签/))

    expect(screen.queryByText(/Gateway|网关/)).not.toBeInTheDocument()
  })

  it('shows gateway in the add menu and creates a gateway tab when available', () => {
    gatewayAvailabilityMock.mockReturnValue({
      status: 'available',
      isAvailable: true,
      isChecking: false,
      refresh: vi.fn(),
    })

    render(
      <PanelContainer position="right" onNewTerminal={vi.fn()}>
        {activeTab => <div>{activeTab?.id}</div>}
      </PanelContainer>,
    )

    fireEvent.click(screen.getByTitle(/Add Tab|添加标签/))
    fireEvent.click(screen.getByText(/Gateway|网关/))

    expect(layoutStore.getState().panelTabs.some(tab => tab.type === 'gateway')).toBe(true)
    expect(layoutStore.getActiveTab('right')?.type).toBe('gateway')
  })
})
