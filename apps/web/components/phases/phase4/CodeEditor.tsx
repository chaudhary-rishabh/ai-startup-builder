'use client'

import type { OnMount } from '@monaco-editor/react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'

const MonacoEditor = dynamic(async () => (await import('@monaco-editor/react')).Editor, {
  ssr: false,
  loading: () => <div className="flex h-full min-h-[200px] flex-1 animate-pulse bg-slate-950" />,
})

function mapMonacoLanguage(language: string): string {
  if (language === 'typescript' || language === 'tsx') return 'typescript'
  if (language === 'javascript' || language === 'jsx') return 'javascript'
  if (language === 'json') return 'json'
  if (language === 'css' || language === 'scss') return 'css'
  if (language === 'html') return 'html'
  if (language === 'yaml') return 'yaml'
  if (language === 'markdown' || language === 'md') return 'markdown'
  return 'plaintext'
}

interface CodeEditorProps {
  content: string | null
  language: string
  path: string
  isLoading: boolean
  isStreaming: boolean
  onContentChange: (value: string) => void
  onSave: (value: string) => void
  onExplainSelection?: (text: string) => void
  onRefactorSelection?: (text: string) => void
  onFixSelection?: (text: string) => void
}

export function CodeEditor({
  content,
  language,
  path,
  isLoading,
  isStreaming,
  onContentChange,
  onSave,
  onExplainSelection,
  onRefactorSelection,
  onFixSelection,
}: CodeEditorProps): JSX.Element {
  const [fadeIn, setFadeIn] = useState(true)

  useEffect(() => {
    setFadeIn(false)
    const t = setTimeout(() => setFadeIn(true), 20)
    return () => clearTimeout(t)
  }, [path, content])

  const handleMount: OnMount = useCallback(
    (ed, monaco) => {
      monaco.editor.defineTheme('ai-startup-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '0D9488' },
          { token: 'string', foreground: 'D97706' },
          { token: 'comment', foreground: '16A34A' },
          { token: 'type', foreground: '2563EB' },
          { token: 'number', foreground: 'F97316' },
          { token: 'delimiter', foreground: '94A3B8' },
        ],
        colors: {
          'editor.background': '#0F172A',
          'editor.lineHighlightBackground': '#1E293B',
          'editorLineNumber.foreground': '#94A3B8',
        },
      })
      monaco.editor.setTheme('ai-startup-dark')

      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave(ed.getValue())
      })

      const bind = (id: string, label: string, cb?: (text: string) => void): void => {
        if (!cb) return
        ed.addAction({
          id,
          label,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.5,
          run: (editor) => {
            const model = editor.getModel()
            const sel = editor.getSelection()
            if (!model || !sel || sel.isEmpty()) return
            const text = model.getValueInRange(sel)
            if (!text.trim()) return
            cb(text)
          },
        })
      }
      bind('asb-explain', '✨ Explain this code', onExplainSelection)
      bind('asb-refactor', '🔄 Refactor', onRefactorSelection)
      bind('asb-fix', '🐛 Fix', onFixSelection)
    },
    [onExplainSelection, onFixSelection, onRefactorSelection, onSave],
  )

  const showEmptyHint = content === null && !isLoading && !isStreaming

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col bg-[#0F172A] ${isStreaming ? 'border-t-2 border-amber-600' : ''}`}
      data-testid="code-editor"
    >
      {showEmptyHint ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="text-sm text-slate-500">Select a file from the explorer to view its code</p>
        </div>
      ) : null}
      {isLoading ? <div className="absolute inset-0 z-20 animate-pulse bg-gradient-to-b from-slate-800 to-slate-900" /> : null}
      <div className={`flex min-h-0 flex-1 flex-col transition-opacity duration-200 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
        <MonacoEditor
          height="100%"
          className="min-h-0 flex-1"
          path={path || 'untitled'}
          language={mapMonacoLanguage(language)}
          theme="ai-startup-dark"
          value={isStreaming ? '' : content ?? ''}
          onChange={(v) => onContentChange(v ?? '')}
          onMount={handleMount}
          options={{
            fontSize: 13,
            lineHeight: 21,
            fontFamily: 'JetBrains Mono, monospace',
            fontLigatures: true,
            minimap: { enabled: true, side: 'right', scale: 1 },
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            automaticLayout: true,
            wordWrap: 'off',
            tabSize: 2,
            insertSpaces: true,
            scrollBeyondLastLine: false,
            folding: true,
            glyphMargin: false,
            padding: { top: 16, bottom: 16 },
            readOnly: isStreaming,
          }}
        />
      </div>
    </div>
  )
}
