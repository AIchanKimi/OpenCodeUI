import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutStore, layoutStore } from './layoutStore'

const STORAGE_KEY_REMEMBER_PANEL_LAYOUT = 'opencode-remember-panel-layout'
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
  state.rememberPanelLayout = false
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
    expect(layoutStore.getState().bottomPanelOpen).toBe(true)
  })

  it('ignores unsupported web preview urls', () => {
    const tabId = layoutStore.openWebPreviewUrl('javascript:alert(1)', 'bottom')

    expect(tabId).toBe('')
    expect(layoutStore.getState().panelTabs.some(tab => tab.type === 'web-preview' && tab.position === 'bottom')).toBe(
      false,
    )
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

describe('LayoutStore panel layout persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to disabled panel layout memory', () => {
    const store = new LayoutStore()

    expect(store.getRememberPanelLayout()).toBe(false)
    expect(store.getState().rightPanelOpen).toBe(false)
    expect(store.getState().bottomPanelOpen).toBe(false)
    expect(store.getState().activeTabId).toEqual({ bottom: null, right: 'files' })
    expect(store.getState().panelTabs.map(tab => tab.id)).toEqual(['files', 'changes'])
  })

  it('persists panel layout when memory is enabled', () => {
    const store = new LayoutStore()

    store.setRememberPanelLayout(true)
    store.toggleRightPanel('changes')
    store.addMcpTab('right')
    store.openBottomPanel()

    expect(localStorage.getItem(STORAGE_KEY_REMEMBER_PANEL_LAYOUT)).toBe('true')

    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL_LAYOUT) ?? 'null')
    expect(snapshot).toMatchObject({
      rightPanelOpen: true,
      bottomPanelOpen: true,
      activeTabId: { bottom: null, right: 'mcp' },
    })
    expect(snapshot.panelTabs).toEqual([
      { id: 'files', type: 'files', position: 'right', previewFile: null, previewFiles: [] },
      { id: 'changes', type: 'changes', position: 'right' },
      { id: 'mcp', type: 'mcp', position: 'right' },
    ])
  })

  it('ignores saved layout snapshots when memory is disabled', () => {
    localStorage.setItem(
      STORAGE_KEY_PANEL_LAYOUT,
      JSON.stringify({
        rightPanelOpen: true,
        bottomPanelOpen: true,
        activeTabId: { bottom: 'worktree', right: 'changes' },
        panelTabs: [
          { id: 'changes', type: 'changes', position: 'right' },
          { id: 'worktree', type: 'worktree', position: 'bottom' },
        ],
      }),
    )

    const store = new LayoutStore()

    expect(store.getRememberPanelLayout()).toBe(false)
    expect(store.getState().rightPanelOpen).toBe(false)
    expect(store.getState().bottomPanelOpen).toBe(false)
    expect(store.getState().activeTabId).toEqual({ bottom: null, right: 'files' })
    expect(store.getState().panelTabs.map(tab => tab.id)).toEqual(['files', 'changes'])
  })

  it('restores saved layout snapshots when memory is enabled', () => {
    localStorage.setItem(STORAGE_KEY_REMEMBER_PANEL_LAYOUT, 'true')
    localStorage.setItem(
      STORAGE_KEY_PANEL_LAYOUT,
      JSON.stringify({
        rightPanelOpen: true,
        bottomPanelOpen: true,
        activeTabId: { bottom: 'skill', right: 'changes' },
        panelTabs: [
          { id: 'files', type: 'files', position: 'right', previewFile: null, previewFiles: [] },
          { id: 'changes', type: 'changes', position: 'right' },
          { id: 'skill', type: 'skill', position: 'bottom' },
        ],
      }),
    )

    const store = new LayoutStore()

    expect(store.getRememberPanelLayout()).toBe(true)
    expect(store.getState().rightPanelOpen).toBe(true)
    expect(store.getState().bottomPanelOpen).toBe(true)
    expect(store.getState().activeTabId).toEqual({ bottom: 'skill', right: 'changes' })
    expect(store.getState().panelTabs).toEqual([
      { id: 'files', type: 'files', position: 'right', previewFile: null, previewFiles: [] },
      { id: 'changes', type: 'changes', position: 'right' },
      { id: 'skill', type: 'skill', position: 'bottom' },
    ])
  })

  it('removes saved layout snapshots when memory is turned off', () => {
    const store = new LayoutStore()

    store.setRememberPanelLayout(true)
    store.openBottomPanel()

    expect(localStorage.getItem(STORAGE_KEY_PANEL_LAYOUT)).not.toBeNull()

    store.setRememberPanelLayout(false)

    expect(localStorage.getItem(STORAGE_KEY_REMEMBER_PANEL_LAYOUT)).toBe('false')
    expect(localStorage.getItem(STORAGE_KEY_PANEL_LAYOUT)).toBeNull()
  })

  it('falls back to the default layout when the saved snapshot is corrupted', () => {
    localStorage.setItem(STORAGE_KEY_REMEMBER_PANEL_LAYOUT, 'true')
    localStorage.setItem(STORAGE_KEY_PANEL_LAYOUT, '{invalid-json')

    const store = new LayoutStore()

    expect(store.getRememberPanelLayout()).toBe(true)
    expect(store.getState().rightPanelOpen).toBe(false)
    expect(store.getState().bottomPanelOpen).toBe(false)
    expect(store.getState().activeTabId).toEqual({ bottom: null, right: 'files' })
    expect(store.getState().panelTabs.map(tab => tab.id)).toEqual(['files', 'changes'])
  })

  it('filters terminal tabs out of saved layout snapshots', () => {
    const store = new LayoutStore()

    store.setRememberPanelLayout(true)
    store.addTerminalTab({ id: 'terminal-1', title: 'Terminal', status: 'connected' }, true, 'right')
    store.addSkillTab('bottom')

    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL_LAYOUT) ?? 'null')
    expect(snapshot.panelTabs).toEqual([
      { id: 'files', type: 'files', position: 'right', previewFile: null, previewFiles: [] },
      { id: 'changes', type: 'changes', position: 'right' },
      { id: 'skill', type: 'skill', position: 'bottom' },
    ])
    expect(snapshot.activeTabId).toEqual({ bottom: 'skill', right: 'files' })
  })

  it('persists web preview tabs in saved layout snapshots', () => {
    const store = new LayoutStore()

    store.setRememberPanelLayout(true)
    const tabId = store.addWebPreviewTab('right')
    store.updateWebPreviewUrl(tabId, 'https://example.com/')

    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL_LAYOUT) ?? 'null')
    expect(snapshot.panelTabs).toContainEqual({
      id: tabId,
      type: 'web-preview',
      position: 'right',
      url: 'https://example.com/',
    })
  })

  it('persists gateway tabs in saved layout snapshots', () => {
    const store = new LayoutStore()

    store.setRememberPanelLayout(true)
    store.addGatewayTab()

    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL_LAYOUT) ?? 'null')
    expect(snapshot.panelTabs).toContainEqual({
      id: 'gateway',
      type: 'gateway',
      position: 'right',
    })
  })
})
