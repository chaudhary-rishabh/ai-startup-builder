import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { usePhaseAdvance } from '@/hooks/usePhaseAdvance'

const advancePhaseMock = vi.fn()
const pushMock = vi.fn()

vi.mock('@/api/projects.api', async () => {
  const actual = await vi.importActual('@/api/projects.api')
  return {
    ...actual,
    advancePhase: (...args: unknown[]) => advancePhaseMock(...args),
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children)
}

describe('usePhaseAdvance', () => {
  it('autopilot can advance when all agents complete', () => {
    const { result } = renderHook(
      () =>
        usePhaseAdvance({
          projectId: 'p1',
          currentPhase: 1,
          buildMode: 'autopilot',
          allAgentsComplete: true,
        }),
      { wrapper },
    )
    expect(result.current.canAdvance).toBe(true)
  })

  it('copilot requires answered card', () => {
    const { result } = renderHook(
      () =>
        usePhaseAdvance({
          projectId: 'p1',
          currentPhase: 1,
          buildMode: 'copilot',
          allAgentsComplete: true,
          copilotAnswered: false,
        }),
      { wrapper },
    )
    expect(result.current.canAdvance).toBe(false)
    expect(result.current.showCopilotCard).toBe(true)
  })

  it('advance calls api and router push', async () => {
    advancePhaseMock.mockResolvedValueOnce({ previousPhase: 1, currentPhase: 2 })
    const { result } = renderHook(
      () =>
        usePhaseAdvance({
          projectId: 'p1',
          currentPhase: 1,
          buildMode: 'autopilot',
          allAgentsComplete: true,
        }),
      { wrapper },
    )
    await result.current.advance()
    expect(advancePhaseMock).toHaveBeenCalledWith('p1', 2)
    expect(pushMock).toHaveBeenCalledWith('/project/p1/plan')
  })
})
