import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { TokenBudgetBanner } from '@/components/common/TokenBudgetBanner'
import { useUIStore } from '@/store/uiStore'

describe('TokenBudgetBanner', () => {
  beforeEach(() => {
    useUIStore.setState({ tokenWarning: null })
  })

  it('renders nothing when tokenWarning is null', () => {
    const { container } = render(<TokenBudgetBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders amber banner for 80%', () => {
    useUIStore.setState({
      tokenWarning: { percentUsed: 80, tokensRemaining: 2000, resetDate: 'May 1' },
    })
    render(<TokenBudgetBanner />)
    expect(screen.getByText(/80%/i)).toBeInTheDocument()
  })

  it('renders red banner for 95%', () => {
    useUIStore.setState({
      tokenWarning: { percentUsed: 95, tokensRemaining: 500, resetDate: 'May 1' },
    })
    render(<TokenBudgetBanner />)
    expect(screen.getByText(/5% of tokens remaining/i)).toBeInTheDocument()
  })

  it('dismiss button clears tokenWarning', () => {
    useUIStore.setState({
      tokenWarning: { percentUsed: 80, tokensRemaining: 2000, resetDate: 'May 1' },
    })
    render(<TokenBudgetBanner />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss budget warning/i }))
    expect(useUIStore.getState().tokenWarning).toBeNull()
  })

  it('upgrade plan link points to /settings/billing', () => {
    useUIStore.setState({
      tokenWarning: { percentUsed: 80, tokensRemaining: 2000, resetDate: 'May 1' },
    })
    render(<TokenBudgetBanner />)
    const link = screen.getByRole('link', { name: /upgrade plan/i })
    expect(link).toHaveAttribute('href', '/settings/billing')
  })

  it('formats tokens remaining with toLocaleString', () => {
    useUIStore.setState({
      tokenWarning: { percentUsed: 80, tokensRemaining: 12000, resetDate: 'May 1' },
    })
    render(<TokenBudgetBanner />)
    expect(screen.getByText(/12,000 tokens remaining/i)).toBeInTheDocument()
  })
})
