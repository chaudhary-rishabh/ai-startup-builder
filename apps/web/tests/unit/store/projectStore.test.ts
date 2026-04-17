import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useProjectStore } from '@/store/projectStore'

describe('projectStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useProjectStore.setState({
      activeProjectId: null,
      currentPhase: 1,
      mode: 'design',
      buildMode: 'copilot',
      isModeTransitioning: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('setBuildMode updates buildMode', () => {
    useProjectStore.getState().setBuildMode('manual')
    expect(useProjectStore.getState().buildMode).toBe('manual')
  })

  it("setMode('dev') transitions for 400ms", () => {
    useProjectStore.getState().setMode('dev')
    expect(useProjectStore.getState().isModeTransitioning).toBe(true)
    vi.advanceTimersByTime(400)
    expect(useProjectStore.getState().isModeTransitioning).toBe(false)
  })

  it('setActiveProject sets id and phase', () => {
    useProjectStore.getState().setActiveProject('proj-1', 3)
    expect(useProjectStore.getState().activeProjectId).toBe('proj-1')
    expect(useProjectStore.getState().currentPhase).toBe(3)
  })

  it('clearProject resets values', () => {
    useProjectStore.getState().setActiveProject('proj-1', 3)
    useProjectStore.getState().clearProject()
    expect(useProjectStore.getState().activeProjectId).toBeNull()
    expect(useProjectStore.getState().currentPhase).toBe(1)
  })
})
