import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ModeToggle } from '@/components/layout/ModeToggle'

const switchToDesign = vi.fn()
const switchToDev = vi.fn()
let mode: 'design' | 'dev' = 'design'
let isModeTransitioning = false

vi.mock('@/hooks/useDesignMode', () => ({
  useDesignMode: () => ({
    mode,
    switchToDesign,
    switchToDev,
    isModeTransitioning,
    isDesign: mode === 'design',
    isDev: mode === 'dev',
  }),
}))

describe('ModeToggle', () => {
  it('renders both mode buttons', () => {
    render(<ModeToggle />)
    expect(screen.getByRole('button', { name: '🎨 Design' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '💻 Dev' })).toBeInTheDocument()
  })

  it('clicking Dev calls switchToDev', () => {
    render(<ModeToggle />)
    fireEvent.click(screen.getByRole('button', { name: '💻 Dev' }))
    expect(switchToDev).toHaveBeenCalled()
  })

  it('active side has correct bg class', () => {
    mode = 'dev'
    const { container } = render(<ModeToggle />)
    expect(container.querySelector('[class*="bg-dev"]')).toBeTruthy()
    mode = 'design'
  })

  it('disabled while transitioning', () => {
    isModeTransitioning = true
    render(<ModeToggle />)
    expect(screen.getByRole('button', { name: '🎨 Design' })).toBeDisabled()
    isModeTransitioning = false
  })

  it('uses layoutId mode-indicator', () => {
    const { container } = render(<ModeToggle />)
    expect(container.querySelector('[class*="bg-design"], [class*="bg-dev"]')).toBeTruthy()
  })
})
