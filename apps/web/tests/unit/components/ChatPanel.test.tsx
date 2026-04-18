import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChatPanel } from '@/components/phases/ChatPanel'

const baseMessages = [
  { id: '1', role: 'user' as const, content: 'hello', timestamp: new Date() },
  { id: '2', role: 'assistant' as const, content: 'hi there', timestamp: new Date() },
]

describe('ChatPanel', () => {
  it('renders header and message sides', () => {
    render(
      <ChatPanel
        projectId="p1"
        phase={1}
        headerLabel="Idea Validator 🧠"
        placeholder="Describe..."
        onSend={vi.fn()}
        messages={baseMessages}
        isAgentRunning={false}
      />,
    )
    expect(screen.getByText('Idea Validator 🧠')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('enter submits and shift enter does not', () => {
    const onSend = vi.fn()
    render(
      <ChatPanel
        projectId="p1"
        phase={1}
        headerLabel="Idea Validator 🧠"
        placeholder="Describe..."
        onSend={onSend}
        messages={[]}
        isAgentRunning={false}
      />,
    )
    const input = screen.getByPlaceholderText('Describe...')
    fireEvent.change(input, { target: { value: 'message' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('message')
    fireEvent.change(input, { target: { value: 'line1' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('typing indicator shown while running', () => {
    render(
      <ChatPanel
        projectId="p1"
        phase={1}
        headerLabel="Idea Validator 🧠"
        placeholder="Describe..."
        onSend={vi.fn()}
        messages={[]}
        isAgentRunning={true}
      />,
    )
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('darkMode uses teal user bubble and slate panel', () => {
    render(
      <ChatPanel
        projectId="p1"
        phase={4}
        headerLabel="Assistant"
        placeholder="Ask..."
        onSend={vi.fn()}
        messages={[{ id: '1', role: 'user', content: 'hi', timestamp: new Date() }]}
        isAgentRunning={false}
        darkMode
      />,
    )
    expect(screen.getByText('hi').className).toMatch(/0D9488/)
  })
})
