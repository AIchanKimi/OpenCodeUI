import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownRenderer } from './MarkdownRenderer'

vi.mock('./CodeBlock', () => ({
  CodeBlock: ({ code, language }: { code: string; language?: string }) => (
    <div data-testid="code-block">{`${language ?? 'text'}:${code}`}</div>
  ),
}))

describe('MarkdownRenderer', () => {
  it('renders headings, inline code and fenced code blocks', () => {
    render(<MarkdownRenderer content={'# Title\n\nUse `pnpm`\n\n```ts\nconst x = 1\n```'} />)

    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
    expect(screen.getByText('pnpm')).toBeInTheDocument()
    expect(screen.getByTestId('code-block')).toHaveTextContent('ts:const x = 1')
  })
})
