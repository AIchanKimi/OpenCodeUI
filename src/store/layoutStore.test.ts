import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutStore, layoutStore } from './layoutStore'

const STORAGE_KEY_PANEL_LAYOUT = 'opencode-panel-layout'

function resetLayoutStore() {
  localStorage.clear()

  const state = layoutStore.getState()
  state.panelTabs.splice(
    0,
    state.panelTabs.length,
    {
      id: 'files',
      type: 'files',
      position: 'right',
      previewFile: null,
      previewFiles: [],
    },
    {
      id: 'changes',
      type: 'changes',
      position: 'right',
    },
  )
  state.activeTabId.bottom = null
  state.activeTabId.right = 'files'
  state.bottomPanelOpen = false
  state.rightPanelOpen = false
  state.bottomPanelHeight = 250
  state.rightPanelWidth = 450
}

describe('layoutStore web preview tabs', () => {
  beforeEach(() => {
    resetLayoutStore()
  })

  afterEach(() => {
    resetLayoutStore()
  })

  it('creates a web preview tab and activates it', () => {
    const tabId = layoutStore.addWebPreviewTab('right')
    const createdTab = layoutStore.getState().panelTabs.find(tab => tab.id === tabId)

    expect(createdTab).toMatchObject({
      id: tabId,
      type: 'web-preview',
      position: 'right',
      url: '',
    })
    expect(layoutStore.getActiveTab('right')?.id).toBe(tabId)
    expect(layoutStore.getState().rightPanelOpen).toBe(true)
  })

  it('updates the url only for web preview tabs', () => {
    const tabId = layoutStore.addWebPreviewTab('bottom')

    layoutStore.updateWebPreviewUrl(tabId, 'https://example.com/')
    layoutStore.updateWebPreviewUrl('files', 'https://ignored.example/')

    expect(layoutStore.getState().panelTabs.find(tab => tab.id === tabId)?.url).toBe('https://example.com/')
    expect(layoutStore.getState().panelTabs.find(tab => tab.id === 'files')?.url).toBeUndefined()
  })

  it('opens a url in a bottom web preview tab', () => {
    const tabId = layoutStore.openWebPreviewUrl('https://example.com/preview', 'bottom')
    const createdTab = layoutStore.getState().panelTabs.find(tab => tab.id === tabId)

    expect(createdTab).toMatchObject({
      id: tabId,
      type: 'web-preview',
      position: 'bottom',
      url: 'https://example.com/preview',
    })
    expect(layoutStore.getActiveTab('bottom')?.id).toBe(tabId)
    expect(layoutStore.getState().bottomPanelOpen).toBe(true)
  })

  it('reuses an existing web preview tab when opening a new url', () => {
    const firstTabId = layoutStore.openWebPreviewUrl('https://example.com/first', 'bottom')
    const secondTabId = layoutStore.openWebPreviewUrl('https://example.com/second', 'bottom')
    const webPreviewTabs = layoutStore
      .getState()
      .panelTabs.filter(tab => tab.type === 'web-preview' && tab.position === 'bottom')

    expect(secondTabId).toBe(firstTabId)
    expect(webPreviewTabs).toHaveLength(1)
    expect(webPreviewTabs[0]?.url).toBe('https://example.com/second')
    expect(layoutStore.getActiveTab('bottom')?.id).toBe(secondTabId)
  })

  it('ignores unsupported web preview urls', () => {
    const tabId = layoutStore.openWebPreviewUrl('javascript:alert(1)', 'bottom')

    expect(tabId).toBe('')
    expect(layoutStore.getState().panelTabs.some(tab => tab.type === 'web-preview' && tab.position === 'bottom')).toBe(
      false,
    )
  })
})

describe('layoutStore gateway tabs', () => {
  beforeEach(() => {
    resetLayoutStore()
  })

  afterEach(() => {
    resetLayoutStore()
  })

  it('creates a gateway tab on the right and activates it', () => {
    const tabId = layoutStore.addGatewayTab()
    const createdTab = layoutStore.getState().panelTabs.find(tab => tab.id === tabId)

    expect(createdTab).toMatchObject({
      id: tabId,
      type: 'gateway',
      position: 'right',
    })
    expect(layoutStore.getActiveTab('right')?.id).toBe(tabId)
    expect(layoutStore.getState().rightPanelOpen).toBe(true)
  })

  it('prevents moving gateway tab to the bottom panel', () => {
    const tabId = layoutStore.addGatewayTab()

    layoutStore.moveTab(tabId, 'bottom')

    const gatewayTab = layoutStore.getState().panelTabs.find(tab => tab.id === tabId)
    expect(gatewayTab?.position).toBe('right')
  })
})

describe('LayoutStore panel and terminal layout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists global panel layout without persisting terminal tabs', () => {
    const store = new LayoutStore()

    store.addMcpTab('bottom')
    store.addTerminalTab({ id: 'term-1', title: 'Terminal 1', status: 'connected' }, true, 'right')
    store.openRightPanel('changes')

    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL_LAYOUT) ?? 'null')
    expect(snapshot).toMatchObject({
      version: 1,
      rightPanelOpen: true,
      bottomPanelOpen: true,
    })
    expect(snapshot.panelTabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'files', type: 'files', position: 'right' }),
        expect.objectContaining({ id: 'changes', type: 'changes', position: 'right' }),
        expect.objectContaining({ id: 'mcp', type: 'mcp', position: 'bottom' }),
      ]),
    )
    expect(snapshot.panelTabs.some((tab: { id: string }) => tab.id === 'term-1')).toBe(false)

    const restored = new LayoutStore().getState()
    expect(restored.rightPanelOpen).toBe(true)
    expect(restored.bottomPanelOpen).toBe(true)
    expect(restored.panelTabs.some(tab => tab.id === 'mcp' && tab.position === 'bottom')).toBe(true)
    expect(restored.panelTabs.some(tab => tab.id === 'term-1')).toBe(false)
  })

  it('restores web preview tabs with their url', () => {
    const store = new LayoutStore()

    const tabId = store.openWebPreviewUrl('https://example.com/preview', 'bottom')
    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL_LAYOUT) ?? 'null')

    expect(snapshot.panelTabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: tabId,
          type: 'web-preview',
          position: 'bottom',
          url: 'https://example.com/preview',
        }),
      ]),
    )

    const restored = new LayoutStore().getState()
    expect(restored.panelTabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: tabId,
          type: 'web-preview',
          position: 'bottom',
          url: 'https://example.com/preview',
        }),
      ]),
    )
  })

  it('restores gateway tabs after reload', () => {
    const store = new LayoutStore()

    store.addGatewayTab()

    const restored = new LayoutStore().getState()
    expect(restored.panelTabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'gateway',
          type: 'gateway',
          position: 'right',
        }),
      ]),
    )
  })

  it('keeps bottom and right panels open when syncing a directory with no terminal sessions', () => {
    const store = new LayoutStore()

    store.openBottomPanel()
    store.openRightPanel('files')
    store.syncTerminalSessions('dir-a', [])

    expect(store.getState().bottomPanelOpen).toBe(true)
    expect(store.getState().rightPanelOpen).toBe(true)
    expect(store.getTerminalTabs('bottom')).toEqual([])
    expect(store.getTerminalTabs('right')).toEqual([])
  })

  it('restores terminal positions for each directory when switching between projects', () => {
    const store = new LayoutStore()

    store.syncTerminalSessions('dir-a', [
      { id: 'term-a1', title: 'A1', status: 'connected' },
      { id: 'term-a2', title: 'A2', status: 'connected' },
    ])
    store.moveTab('term-a2', 'right')

    store.syncTerminalSessions('dir-b', [{ id: 'term-b1', title: 'B1', status: 'connected' }])
    store.syncTerminalSessions('dir-a', [
      { id: 'term-a1', title: 'A1', status: 'connected' },
      { id: 'term-a2', title: 'A2', status: 'connected' },
    ])

    expect(store.getTerminalTabs('bottom').map(tab => tab.id)).toEqual(['term-a1'])
    expect(store.getTerminalTabs('right').map(tab => tab.id)).toEqual(['term-a2'])
  })

  it('falls back to a valid right tab when a stale terminal active id disappears after sync', () => {
    const store = new LayoutStore()

    store.syncTerminalSessions('dir-a', [{ id: 'term-a1', title: 'A1', status: 'connected' }])
    store.moveTab('term-a1', 'right')
    store.setActiveTab('right', 'term-a1')

    store.syncTerminalSessions('dir-b', [])

    expect(store.getState().activeTabId.right).toBe('files')
  })
})
