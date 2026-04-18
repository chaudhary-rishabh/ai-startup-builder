import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginForm } from '@/components/auth/LoginForm'

const mockPush = vi.fn()
const mockLogin = vi.fn()
const mockLoginWithTotp = vi.fn()
const mockForgotPassword = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/api/auth.api', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  loginWithTotp: (...args: unknown[]) => mockLoginWithTotp(...args),
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockLogin.mockReset()
    mockLoginWithTotp.mockReset()
    mockForgotPassword.mockReset()
  })

  it('renders email + password fields', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('wrong credentials shows inline error', async () => {
    mockLogin.mockRejectedValueOnce({ code: 'INVALID_CREDENTIALS' })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('ACCOUNT_LOCKED error shows lockout message', async () => {
    mockLogin.mockRejectedValueOnce({ code: 'ACCOUNT_LOCKED' })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(
      await screen.findByText('Account locked due to too many attempts. Try again in 15 minutes.'),
    ).toBeInTheDocument()
  })

  it('forgot password link shows reset form', async () => {
    render(<LoginForm />)
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }))
    expect(await screen.findByText('Enter your email to receive a reset link')).toBeInTheDocument()
  })

  it('loading spinner appears on submit', async () => {
    let resolver: (() => void) | undefined
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve as () => void
        }),
    )
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'good' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled())
    resolver?.()
  })
})
