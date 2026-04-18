'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { forgotPassword, login, loginWithTotp } from '@/api/auth.api'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { useAuthStore } from '@/store/authStore'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm(): JSX.Element {
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)

  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const emailValue = watch('email')

  const onSubmit = async (values: LoginValues): Promise<void> => {
    setIsSubmitting(true)
    setInlineError(null)
    try {
      const result = await login(values)
      if (result.requiresTwoFactor && result.tempToken) {
        setTempToken(result.tempToken)
        return
      }
      setUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        avatarUrl: null,
        role: result.user.role as 'user' | 'admin' | 'super_admin',
        plan: result.user.plan as 'free' | 'pro' | 'team' | 'enterprise',
        onboardingDone: true,
      })
      const redirectTarget =
        typeof window !== 'undefined' ? sessionStorage.getItem('post_auth_redirect') || '/dashboard' : '/dashboard'
      router.push(redirectTarget)
    } catch (error: unknown) {
      const appError = error as { code?: string }
      if (appError.code === 'INVALID_CREDENTIALS') {
        setInlineError('Invalid email or password')
      } else if (appError.code === 'ACCOUNT_LOCKED') {
        setInlineError('Account locked due to too many attempts. Try again in 15 minutes.')
      } else if (appError.code === 'ACCOUNT_NOT_VERIFIED') {
        setInlineError('Please verify your email first. Resend verification →')
        if (values.email) {
          await forgotPassword(values.email)
        }
      } else {
        setInlineError('Unable to sign in right now.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTotpSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!tempToken) {
      return
    }
    setIsSubmitting(true)
    setInlineError(null)
    try {
      const result = await loginWithTotp({ tempToken, totpCode })
      setUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        avatarUrl: null,
        role: result.user.role as 'user' | 'admin' | 'super_admin',
        plan: result.user.plan as 'free' | 'pro' | 'team' | 'enterprise',
        onboardingDone: true,
      })
      router.push('/dashboard')
    } catch {
      setInlineError('Invalid authentication code.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showForgotPassword) {
    return <ForgotPasswordForm initialEmail={emailValue} onBack={() => setShowForgotPassword(false)} />
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div>
          <input
            aria-label="Email"
            type="email"
            placeholder="you@example.com"
            className="h-11 w-full rounded-md border border-divider bg-card px-3 text-sm text-heading"
            {...register('email')}
          />
          {errors.email ? <p className="mt-1 text-xs text-error">{errors.email.message}</p> : null}
        </div>
        <div>
          <div className="relative">
            <input
              aria-label="Password"
              type={showPassword ? 'text' : 'password'}
              className="h-11 w-full rounded-md border border-divider bg-card px-3 pr-10 text-sm text-heading"
              {...register('password')}
            />
            <button
              type="button"
              aria-label="Toggle password visibility"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="mt-1 text-xs text-muted underline underline-offset-2"
          >
            Forgot password?
          </button>
          {errors.password ? <p className="mt-1 text-xs text-error">{errors.password.message}</p> : null}
        </div>

        {inlineError ? <p className="text-xs text-error">{inlineError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:brightness-90 disabled:opacity-70"
        >
          {isSubmitting ? <LoadingSpinner className="text-white" /> : null}
          Sign In →
        </button>
      </form>

      {tempToken ? (
        <form onSubmit={handleTotpSubmit} className="space-y-2 rounded-card border border-divider bg-output p-4">
          <p className="text-xs text-heading">Enter your 6-digit authentication code</p>
          <input
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value)}
            maxLength={6}
            inputMode="numeric"
            className="h-10 w-full rounded-md border border-divider bg-card px-3 text-sm text-heading"
            aria-label="TOTP code"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:brightness-90 disabled:opacity-70"
          >
            {isSubmitting ? <LoadingSpinner className="text-white" /> : null}
            Verify code
          </button>
        </form>
      ) : null}
    </div>
  )
}
