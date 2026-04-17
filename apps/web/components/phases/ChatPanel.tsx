'use client'

import { RefreshCw, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

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
  onSend: (message: string) => void
  messages: ChatMessage[]
  isAgentRunning: boolean
}

export function ChatPanel({
  headerLabel,
  placeholder,
  onSend,
  messages,
  isAgentRunning,
}: ChatPanelProps): JSX.Element {
  const [text, setText] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const listRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const [showNewMessageChip, setShowNewMessageChip] = useState(false)

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

  return (
    <aside className="flex h-full w-[320px] flex-shrink-0 flex-col rounded-r-xl bg-card shadow-md max-md:hidden">
      <header className="flex h-12 items-center justify-between border-b border-divider px-3">
        <p className="text-sm font-medium text-heading">{headerLabel}</p>
        <button type="button" aria-label="Clear chat history" className="text-muted">
          <RefreshCw size={16} />
        </button>
      </header>

      <div
        ref={listRef}
        className="relative flex-1 overflow-y-auto p-3"
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
                <p key={message.id} className="text-center text-[11px] italic text-muted">
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
                      ? 'rounded-bl-xl rounded-br-chip rounded-tl-xl rounded-tr-chip bg-brand text-white'
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
              <div className="rounded-bl-chip rounded-br-xl rounded-tl-chip rounded-tr-xl border border-divider bg-card px-3 py-2 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand/60" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand/80 [animation-delay:200ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:400ms]" />
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

      <div className="border-t border-divider p-3">
        <div className="relative">
          <textarea
            value={text}
            rows={Math.min(3, Math.max(1, text.split('\n').length))}
            placeholder={placeholder}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            className="max-h-[96px] min-h-[44px] w-full resize-none rounded-full border-[1.5px] border-divider bg-bg px-4 py-3 pr-12 text-sm focus:border-brand"
          />
          <button
            type="button"
            aria-label="Send message"
            disabled={!text.trim() || isAgentRunning}
            onClick={submit}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50"
          >
            <Send size={14} />
          </button>
          {text.length > 200 ? <span className="absolute right-12 top-1 text-[10px] text-muted">{text.length}</span> : null}
        </div>
      </div>
    </aside>
  )
}
