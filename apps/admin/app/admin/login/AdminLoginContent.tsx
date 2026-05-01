'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Cog, Loader2, ShieldAlert, KeyRound } from 'lucide-react'
import { adminLogin, adminVerifyTotp } from '@/lib/api/auth.api'
import { useAdminAuthStore } from '@/store/adminAuthStore'
import { cn } from '@/lib/cn'

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
})

const totpSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Digits only'),
})

type CredentialsForm = z.infer<typeof credentialsSchema>
type TotpForm = z.infer<typeof totpSchema>

export function AdminLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAdmin, isAuthenticated } = useAdminAuthStore()

  const [step, setStep] = useState<'credentials' | 'totp'>('credentials')
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [lockout, setLockout] = useState<{ endsAt: Date } | null>(null)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (!lockout) return
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((lockout.endsAt.getTime() - Date.now()) / 1000),
      )
      setCountdown(remaining)
      if (remaining === 0) {
        setLockout(null)
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockout])

  useEffect(() => {
    const prev = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#5C4425'
    return () => {
      document.body.style.backgroundColor = prev
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get('redirect') ?? '/admin/dashboard'
      router.replace(redirect)
    }
  }, [isAuthenticated, router, searchParams])

  const {
    register: registerCreds,
    handleSubmit: handleCreds,
    setError: setCredsError,
    formState: { errors: credsErrors, isSubmitting: isSubmittingCreds },
  } = useForm<CredentialsForm>({ resolver: zodResolver(credentialsSchema) })

  const onCredentialsSubmit = async (data: CredentialsForm) => {
    try {
      const res = await adminLogin(data)
      setTempToken(res.tempToken)
      setStep('totp')
    } catch (err: unknown) {
      const e = err as {
        code?: string
        message?: string
        lockoutEndsAt?: string
      }
      if (e.code === 'ACCOUNT_LOCKED' && e.lockoutEndsAt) {
        setLockout({ endsAt: new Date(e.lockoutEndsAt) })
        setCountdown(
          Math.ceil(
            (new Date(e.lockoutEndsAt).getTime() - Date.now()) / 1000,
          ),
        )
      } else {
        setCredsError('root', {
          message: e.message ?? 'Invalid email or password',
        })
      }
    }
  }

  const {
    register: registerTotp,
    handleSubmit: handleTotp,
    setError: setTotpError,
    formState: { errors: totpErrors, isSubmitting: isSubmittingTotp },
  } = useForm<TotpForm>({ resolver: zodResolver(totpSchema) })

  const onTotpSubmit = async (data: TotpForm) => {
    if (!tempToken) return
    try {
      const res = await adminVerifyTotp(tempToken, data.code)
      setAdmin(res.admin)
      const redirect = searchParams.get('redirect') ?? '/admin/dashboard'
      router.replace(redirect)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setTotpError('root', {
        message: e.message ?? 'Invalid code — try again',
      })
    }
  }

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#5C4425' }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, #EDE5D8 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.05,
        }}
      />

      <div className="relative z-10 w-full max-w-[480px] mx-4">
        <div className="bg-card rounded-panel shadow-lg p-10">
          <div className="text-center mb-8">
            <Cog className="w-10 h-10 text-muted mx-auto" />
            <h1 className="font-display text-2xl text-heading mt-3">
              Admin Panel
            </h1>
            <p className="text-sm text-muted mt-1">AI Startup Builder</p>
          </div>

          {lockout && (
            <div className="flex items-start gap-3 bg-red-50 border border-error rounded-card p-4 mb-6">
              <ShieldAlert className="w-5 h-5 text-error mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-error">
                  Account temporarily locked
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Too many failed attempts. Try again in{' '}
                  <span className="font-mono font-bold">
                    {formatCountdown(countdown)}
                  </span>
                </p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'credentials' && (
              <motion.form
                key="credentials"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCreds(onCredentialsSubmit)}
                className="space-y-4"
              >
                {credsErrors.root && (
                  <p className="text-sm text-error bg-red-50 border border-red-200 rounded-card px-3 py-2">
                    {credsErrors.root.message}
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-heading uppercase tracking-wide mb-1.5">
                    Email
                  </label>
                  <input
                    {...registerCreds('email')}
                    type="email"
                    autoComplete="email"
                    placeholder="admin@yourdomain.com"
                    disabled={!!lockout}
                    className={cn(
                      'w-full h-11 px-3 rounded-card border bg-white text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-brand',
                      'placeholder:text-muted transition-shadow',
                      credsErrors.email
                        ? 'border-error'
                        : 'border-divider hover:border-brand-light',
                      lockout && 'opacity-50 cursor-not-allowed',
                    )}
                  />
                  {credsErrors.email && (
                    <p className="text-xs text-error mt-1">
                      {credsErrors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-heading uppercase tracking-wide mb-1.5">
                    Password
                  </label>
                  <input
                    {...registerCreds('password')}
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={!!lockout}
                    className={cn(
                      'w-full h-11 px-3 rounded-card border bg-white text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-brand',
                      'placeholder:text-muted transition-shadow',
                      credsErrors.password
                        ? 'border-error'
                        : 'border-divider hover:border-brand-light',
                      lockout && 'opacity-50 cursor-not-allowed',
                    )}
                  />
                  {credsErrors.password && (
                    <p className="text-xs text-error mt-1">
                      {credsErrors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingCreds || !!lockout}
                  className={cn(
                    'w-full h-12 rounded-card text-sm font-semibold',
                    'bg-heading text-white transition-opacity mt-2',
                    'flex items-center justify-center gap-2',
                    isSubmittingCreds || lockout
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-90',
                  )}
                >
                  {isSubmittingCreds ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    'Continue →'
                  )}
                </button>
              </motion.form>
            )}

            {step === 'totp' && (
              <motion.form
                key="totp"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleTotp(onTotpSubmit)}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center flex-shrink-0">
                    <KeyRound className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-heading">
                      Two-factor authentication
                    </p>
                    <p className="text-xs text-muted">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>
                </div>

                {totpErrors.root && (
                  <p className="text-sm text-error bg-red-50 border border-red-200 rounded-card px-3 py-2">
                    {totpErrors.root.message}
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-heading uppercase tracking-wide mb-1.5">
                    Authentication Code
                  </label>
                  <input
                    {...registerTotp('code')}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    autoFocus
                    className={cn(
                      'w-full h-14 px-4 rounded-card border bg-white',
                      'text-center text-2xl font-mono tracking-widest',
                      'focus:outline-none focus:ring-2 focus:ring-brand',
                      'placeholder:text-muted transition-shadow',
                      totpErrors.code
                        ? 'border-error'
                        : 'border-divider hover:border-brand-light',
                    )}
                  />
                  {totpErrors.code && (
                    <p className="text-xs text-error mt-1">
                      {totpErrors.code.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingTotp}
                  className={cn(
                    'w-full h-12 rounded-card text-sm font-semibold',
                    'bg-heading text-white transition-opacity mt-2',
                    'flex items-center justify-center gap-2',
                    isSubmittingTotp
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-90',
                  )}
                >
                  {isSubmittingTotp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    'Login to Admin'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials')
                    setTempToken(null)
                  }}
                  className="w-full text-xs text-muted hover:text-brand transition-colors text-center mt-1"
                >
                  ← Back to credentials
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#C4A882' }}>
          This area is for platform administrators only.
        </p>
      </div>
    </div>
  )
}
