'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, MessageSquare, Send, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { sendChatMessage } from '@/api/chat.api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export function ChatAssistant(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setOpen((prev) => !prev), [])

  // Keyboard shortcut: Ctrl+Alt+Space
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.altKey && event.code === 'Space') {
        event.preventDefault()
        toggle()
      }
      if (event.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, toggle])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await sendChatMessage(text, 'deepseek-v4-flash')
      if (!res.content?.trim()) {
        throw new Error('Empty response from AI')
      }
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.content,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ?? 'Something went wrong. Please try again.'
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: message,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }, [input, loading])

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-5 left-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        aria-label="Open AI chat assistant"
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            {/* Backdrop */}
            <motion.div
              key="chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/15 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Chat panel */}
            <motion.div
              key="chat-panel"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed bottom-20 left-5 z-50 flex w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-card border border-divider bg-card/90 shadow-lg backdrop-blur-md"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-divider px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand">
                    <MessageSquare size={14} className="text-white" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold text-heading">AI Assistant</p>
                    <p className="text-[10px] text-muted">DeepSeek V4</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="rounded-chip bg-output px-2 py-0.5 text-[10px] text-muted">Ctrl+Alt+Space</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md p-1 hover:bg-divider text-muted"
                    aria-label="Close chat"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-[360px]">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-muted py-8">
                    Ask me anything about your startup projects.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-brand text-white rounded-br-md'
                            : 'bg-output border border-divider text-heading rounded-bl-md'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {loading ? (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-output border border-divider px-4 py-3">
                      <Loader2 size={14} className="animate-spin text-muted" />
                      <span className="text-xs text-muted">Thinking…</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Input */}
              <div className="border-t border-divider px-4 py-3">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleSend()
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask anything…"
                    className="h-10 flex-1 rounded-full border border-divider bg-bg px-4 text-sm placeholder:text-muted focus:outline-none focus:border-brand"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white transition hover:brightness-90 disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
