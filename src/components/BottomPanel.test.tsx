import { fireEvent, render, screen } from '@testing-library/react'
import { waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomPanel } from './BottomPanel'

const createPtySessionMock = vi.fn().mockResolvedValue({ id: 'pty-1', title: 'Terminal' })

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('./PanelContainer', () => ({
  PanelContainer: ({ children }: { children: (activeTab: null) => React.ReactNode }) => <div>{children(null)}</div>,
}))

vi.mock('./ui/ResizablePanel', () => ({
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../store/layoutStore', () => ({
  layoutStore: {
    setCurrentTerminalDirectory: vi.fn(),
    syncTerminalSessions: vi.fn(),
    addTerminalTab: vi.fn(),
    setBottomPanelHeight: vi.fn(),
    closeBottomPanel: vi.fn(),
  },
  useLayoutStore: () => ({
    bottomPanelOpen: true,
    bottomPanelHeight: 320,
  }),
}))

vi.mock('../api/pty', () => ({
  createPtySession: (...args: unknown[]) => createPtySessionMock(...args),
  removePtySession: vi.fn(),
  listPtySessions: vi.fn().mockResolvedValue([]),
}))

vi.mock('../store', () => ({
  useMessageStore: () => ({ sessionId: null }),
}))

vi.mock('../features/chat/chatViewport', () => ({
  useChatViewport: () => ({
    interaction: { bottomPanelBehavior: 'dock' },
    layout: { bottomPanel: { maxHeight: 500 } },
  }),
}))

describe('BottomPanel global terminal cwd', () => {
  it('creates terminals from unix root in global mode', async () => {
    render(<BottomPanel directory="" />)

    await waitFor(() => expect(screen.getByText('terminal.createTerminal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('terminal.createTerminal'))

    await waitFor(() => expect(createPtySessionMock).toHaveBeenCalledWith({ cwd: '/' }, undefined))
  })
})
