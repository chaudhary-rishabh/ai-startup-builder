import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useAgentStream } from '@/hooks/useAgentStream'
import { useUIStore } from '@/store/uiStore'
import { MockEventSource } from '@/tests/mocks/mockEventSource'

describe('useAgentStream', () => {
  it('start creates EventSource with credentials', () => {
    const onToken = vi.fn()
    const { result } = renderHook(() => useAgentStream({ onToken }))
    act(() => result.current.start('run-1'))
    const es = MockEventSource.instances[0]
    expect(es?.url).toContain('/ai/runs/run-1/stream')
    expect(es?.withCredentials).toBe(true)
  })

  it('routes token and doc_mode events', () => {
    const onToken = vi.fn()
    const onDocMode = vi.fn()
    const { result } = renderHook(() => useAgentStream({ onToken, onDocMode }))
    act(() => result.current.start('run-1'))
    const es = MockEventSource.instances[0]!
    act(() => {
      es.dispatchEvent('token', { type: 'token', token: 'hi', runId: 'run-1' })
      es.dispatchEvent('doc_mode', { type: 'doc_mode', mode: 'direct', docCount: 2, tokenCount: 24000, runId: 'run-1' })
    })
    expect(onToken).toHaveBeenCalled()
    expect(onDocMode).toHaveBeenCalled()
  })

  it('maps done to run_complete and stops stream', () => {
    const onRunComplete = vi.fn()
    const { result } = renderHook(() => useAgentStream({ onRunComplete }))
    act(() => result.current.start('run-1'))
    const es = MockEventSource.instances[0]!
    act(() => {
      es.dispatchEvent('done', { runId: 'run-1', tokensUsed: 10, durationMs: 100, output: {} })
    })
    expect(onRunComplete).toHaveBeenCalledWith(expect.objectContaining({ type: 'run_complete' }))
    expect(result.current.isStreaming).toBe(false)
  })

  it('server error event triggers onError and stop', () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useAgentStream({ onError }))
    act(() => result.current.start('run-1'))
    const es = MockEventSource.instances[0]!
    act(() => {
      es.dispatchEvent('error', { type: 'error', code: 'E', message: 'boom', runId: 'run-1' })
    })
    expect(onError).toHaveBeenCalled()
    expect(result.current.isStreaming).toBe(false)
  })

  it('network onerror only when CLOSED', () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useAgentStream({ onError }))
    act(() => result.current.start('run-1'))
    const es = MockEventSource.instances[0]!
    act(() => {
      es.readyState = MockEventSource.CONNECTING
      es.onerror?.({})
    })
    expect(onError).not.toHaveBeenCalled()
    act(() => {
      es.readyState = MockEventSource.CLOSED
      es.onerror?.({})
    })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONNECTION_LOST' }))
  })

  it('token budget warning updates ui store', () => {
    const onTokenBudgetWarning = vi.fn()
    const { result } = renderHook(() => useAgentStream({ onTokenBudgetWarning }))
    act(() => result.current.start('run-1'))
    const es = MockEventSource.instances[0]!
    act(() => {
      es.dispatchEvent('token.budget.warning', {
        type: 'token.budget.warning',
        percentUsed: 80,
        tokensUsed: 40000,
        tokenLimit: 50000,
        runId: 'run-1',
      })
    })
    expect(onTokenBudgetWarning).toHaveBeenCalled()
    expect(useUIStore.getState().tokenWarning?.percentUsed).toBe(80)
    expect(useUIStore.getState().tokenWarning?.tokensRemaining).toBe(10000)
  })
})
