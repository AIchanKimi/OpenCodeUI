import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CodeMirror from '@uiw/react-codemirror'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { useTheme } from '../hooks/useTheme'

interface FileTextEditorProps {
  fileName: string
  value: string
  language: string
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  onChange: (value: string) => void
  onSave: () => void
}

function getLanguageExtension(language: string): Extension | null {
  switch (language) {
    case 'javascript':
      return javascript()
    case 'jsx':
      return javascript({ jsx: true })
    case 'typescript':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'json':
    case 'jsonc':
      return javascript()
    case 'html':
      return html()
    case 'css':
    case 'scss':
    case 'less':
      return css()
    case 'markdown':
      return markdown()
    case 'python':
      return python()
    case 'yaml':
      return yaml()
    case 'sql':
      return sql()
    case 'xml':
      return xml()
    case 'rust':
      return rust()
    case 'go':
      return go()
    default:
      return null
  }
}

export function FileTextEditor({
  fileName,
  value,
  language,
  isDirty,
  isSaving,
  saveError,
  onChange,
  onSave,
}: FileTextEditorProps) {
  const { t } = useTranslation(['common'])
  const { isDark } = useTheme()

  const editorTheme = useMemo(
    () =>
      EditorView.theme({
        '&': {
          height: '100%',
          color: 'hsl(var(--text-100))',
          backgroundColor: 'hsl(var(--bg-100))',
        },
        '.cm-editor': {
          height: '100%',
          backgroundColor: 'hsl(var(--bg-100))',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          backgroundColor: 'hsl(var(--bg-100))',
        },
        '.cm-content': {
          minHeight: '100%',
          padding: '12px 16px',
          fontSize: '12px',
          lineHeight: '1.5rem',
          color: 'hsl(var(--text-100))',
          caretColor: 'hsl(var(--text-100))',
        },
        '.cm-gutters': {
          backgroundColor: 'hsl(var(--bg-100))',
          borderRight: '1px solid hsl(var(--border-100) / 0.9)',
          color: 'hsl(var(--text-400))',
        },
        '.cm-activeLine': {
          backgroundColor: isDark ? 'hsl(var(--bg-200) / 0.5)' : 'hsl(var(--bg-200) / 0.75)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: isDark ? 'hsl(var(--bg-200) / 0.5)' : 'hsl(var(--bg-200) / 0.75)',
          color: 'hsl(var(--text-300))',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: 'hsl(var(--text-100))',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: isDark ? 'hsl(var(--accent-main-100) / 0.28)' : 'hsl(var(--accent-main-100) / 0.18)',
        },
        '.cm-panels': {
          backgroundColor: 'hsl(var(--bg-000))',
          color: 'hsl(var(--text-200))',
        },
        '.cm-tooltip': {
          border: '1px solid hsl(var(--border-100))',
          backgroundColor: 'hsl(var(--bg-000))',
          color: 'hsl(var(--text-100))',
        },
        '&.cm-focused': {
          outline: 'none',
        },
      }),
    [isDark],
  )

  const extensions = useMemo(() => {
    const editorExtensions: Extension[] = [
      editorTheme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-label': `editor ${fileName}`,
        'data-testid': `editor-${fileName}`,
      }),
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            onSave()
            return true
          },
        },
      ]),
    ]

    const languageExtension = getLanguageExtension(language)
    if (languageExtension) {
      editorExtensions.push(languageExtension)
    }

    return editorExtensions
  }, [editorTheme, fileName, language, onSave])

  return (
    <div className="flex h-full flex-col bg-bg-100 min-h-0">
      <div className="flex items-center justify-between border-b border-bg-300 px-3 py-1 text-[11px] text-text-400">
        <span>{fileName}</span>
        <span>{isSaving ? t('common:loading') : isDirty ? '*' : ''}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          height="100%"
          theme={isDark ? 'dark' : 'light'}
          className="h-full text-[12px]"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            highlightActiveLineGutter: true,
          }}
        />
      </div>
      {saveError ? (
        <div className="border-t border-bg-300 px-3 py-2 text-[11px] text-danger-100">{saveError}</div>
      ) : null}
    </div>
  )
}
