import { beforeEach, describe, expect, it } from 'vitest'
import { LayoutStore } from './layoutStore'

const STORAGE_KEY_REMEMBER_PANEL_LAYOUT = 'opencode-remember-panel-layout'
const STORAGE_KEY_PANEL_LAYOUT = 'opencode-panel-layout'

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
})
