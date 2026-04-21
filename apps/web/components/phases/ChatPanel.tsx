'use client'

import { RefreshCw, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
  timestamp: Date
}

interface ChatPanelProps {
  projectId: string
  phase: number
  headerLabel: string
  placeholder: string
  chatContext?: 'prd' | 'flow' | 'system' | 'uiux' | 'validate' | 'design' | 'growth'
  onSend: (message: string) => void
  messages: ChatMessage[]
  isAgentRunning: boolean
  darkMode?: boolean
  className?: string
  /** When set, replaces the draft in the input and focuses the textarea (e.g. “Fix this test”). */
  draftMessage?: string | null
}

export function ChatPanel({
  headerLabel,
  placeholder,
  chatContext,
  onSend,
  messages,
  isAgentRunning,
  darkMode = false,
  className = '',
  draftMessage = null,
}: ChatPanelProps): JSX.Element {
  const [text, setText] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const listRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [showNewMessageChip, setShowNewMessageChip] = useState(false)

  useEffect(() => {
    if (draftMessage == null || draftMessage === '') return
    setText(draftMessage)
    queueMicrotask(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(draftMessage.length, draftMessage.length)
    })
  }, [draftMessage])

  useEffect(() => {
    if (isAtBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
      setShowNewMessageChip(false)
    } else if (messages.length) {
      setShowNewMessageChip(true)
    }
  }, [messages.length, isAtBottom])

  const submit = (): void => {
    const value = text.trim()
    if (!value || isAgentRunning) return
    onSend(value)
    setText('')
  }

  const streamingMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message?.isStreaming) return message
    }
    return undefined
  }, [messages])

  const resolvedPlaceholder = useMemo(() => {
    if (chatContext === 'prd') return 'Ask about features, user stories, priorities...'
    if (chatContext === 'flow') return 'Ask about user journey, flows, drop-off points...'
    if (chatContext === 'system') return 'Ask about tech stack, architecture, APIs...'
    if (chatContext === 'uiux') return 'Ask about screens, wireframes, design tokens...'
    if (chatContext === 'growth') return 'Ask about acquisition, retention, and GTM...'
    return placeholder
  }, [chatContext, placeholder])

  return (
    <aside
      className={cn(
        'flex h-full w-[320px] flex-shrink-0 flex-col rounded-r-xl bg-card shadow-md max-md:hidden md:flex',
        darkMode && 'bg-slate-950',
        className,
      )}
    >
      <header
        className={cn(
          'flex h-12 items-center justify-between border-b px-3',
          darkMode ? 'border-slate-700 bg-slate-900' : 'border-divider',
        )}
      >
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-200' : 'text-heading'}`}>{headerLabel}</p>
        <button type="button" aria-label="Clear chat history" className="text-muted">
          <RefreshCw size={16} />
        </button>
      </header>

      <div
        ref={listRef}
        className={cn('relative flex-1 overflow-y-auto p-3', darkMode && 'bg-slate-950')}
        onScroll={(event) => {
          const target = event.currentTarget
          const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 20
          setIsAtBottom(nearBottom)
        }}
      >
        <div className="space-y-2">
          {messages.map((message) => {
            if (message.role === 'system') {
              return (
                <p key={message.id} className={`text-center text-[11px] italic ${darkMode ? 'text-slate-500' : 'text-muted'}`}>
                  {message.content}
                </p>
              )
            }

            const isUser = message.role === 'user'
            return (
              <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 text-sm ${
                    isUser
                      ? darkMode
                        ? 'rounded-bl-xl rounded-br-xl rounded-tl-xl rounded-tr-xl bg-[#0D9488] text-white'
                        : 'rounded-bl-xl rounded-br-chip rounded-tl-xl rounded-tr-chip bg-brand text-white'
                      : darkMode
                        ? 'rounded-xl border border-slate-700 bg-slate-800 text-slate-200 shadow-sm'
                        : 'rounded-bl-chip rounded-br-xl rounded-tl-chip rounded-tr-xl border border-divider bg-card text-heading shadow-sm'
                  }`}
                >
                  {message.content}
                  {message.isStreaming ? <span className="ml-1 inline-block animate-pulse">|</span> : null}
                </div>
              </div>
            )
          })}

          {isAgentRunning && !streamingMessage ? (
            <div className="flex justify-start">
              <div
                className={
                  darkMode
                    ? 'rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 shadow-sm'
                    : 'rounded-bl-chip rounded-br-xl rounded-tl-chip rounded-tr-xl border border-divider bg-card px-3 py-2 shadow-sm'
                }
              >
                <div className="flex gap-1">
                  <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${darkMode ? 'bg-teal-500/60' : 'bg-brand/60'}`} />
                  <span
                    className={`h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:200ms] ${darkMode ? 'bg-teal-500/80' : 'bg-brand/80'}`}
                  />
                  <span className={`h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:400ms] ${darkMode ? 'bg-teal-500' : 'bg-brand'}`} />
                </div>
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {showNewMessageChip ? (
          <button
            type="button"
            className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs text-white shadow-md"
            onClick={() => {
              endRef.current?.scrollIntoView({ behavior: 'smooth' })
              setShowNewMessageChip(false)
            }}
          >
            ↓ New message
          </button>
        ) : null}
      </div>

      <div className={darkMode ? 'border-t border-slate-700 bg-slate-900 p-3' : 'border-t border-divider p-3'}>
        <div className="relative">
          <textarea
            ref={inputRef}
            value={text}
            rows={Math.min(3, Math.max(1, text.split('\n').length))}
            placeholder={resolvedPlaceholder}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            className={
              darkMode
                ? 'max-h-[96px] min-h-[44px] w-full resize-none rounded-full border-[1.5px] border-slate-600 bg-slate-700 px-4 py-3 pr-12 text-sm text-slate-200 focus:border-[#0D9488]'
                : 'max-h-[96px] min-h-[44px] w-full resize-none rounded-full border-[1.5px] border-divider bg-bg px-4 py-3 pr-12 text-sm focus:border-brand'
            }
          />
          <button
            type="button"
            aria-label="Send message"
            disabled={!text.trim() || isAgentRunning}
            onClick={submit}
            className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white disabled:opacity-50 ${
              darkMode ? 'bg-[#0D9488]' : 'bg-brand'
            }`}
          >
            <Send size={14} />
          </button>
          {text.length > 200 ? (
            <span className={`absolute right-12 top-1 text-[10px] ${darkMode ? 'text-slate-400' : 'text-muted'}`}>{text.length}</span>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
