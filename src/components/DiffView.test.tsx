import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DiffView } from './DiffView'

vi.mock('../hooks/useSyntaxHighlight', () => ({
  useSyntaxHighlight: (code: string, options?: { mode?: 'html' | 'tokens' }) => ({
    output: options?.mode === 'tokens' ? code.split('\n').map(line => [{ content: line, color: '#fff' }]) : null,
    isLoading: false,
  }),
}))

vi.mock('./FullscreenViewer', () => ({
  FullscreenViewer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="fullscreen-viewer">viewer</div> : null,
}))

describe('DiffView', () => {
  it('renders diff stats and can open fullscreen viewer', () => {
    render(
      <DiffView
        before={'const a = 1\nconst keep = true'}
        after={'const a = 2\nconst keep = true'}
        filePath="src/app.ts"
      />,
    )

    expect(screen.getByText('app.ts')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('全屏查看'))
    expect(screen.getByTestId('fullscreen-viewer')).toBeInTheDocument()
  })
})
