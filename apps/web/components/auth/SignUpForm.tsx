'use client'

import { useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import * as Select from '@radix-ui/react-select'
import { z } from 'zod'

import { register, verifyEmail } from '@/api/auth.api'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useUIStore } from '@/store/uiStore'

const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['FOUNDER', 'DESIGNER', 'DEVELOPER', 'OTHER'], {
    required_error: 'Please select your role',
  }),
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  terms: z.boolean().refine((value) => value, 'You must accept the terms'),
})

type SignUpValues = z.infer<typeof signUpSchema>

function getStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  return score
}

export function SignUpForm(): JSX.Element {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const addToast = useUIStore((state) => state.addToast)
  const router = useRouter()
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])

  const {
    register: registerField,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      terms: false,
    },
  })

  const passwordStrength = useMemo(() => getStrength(watch('password')), [watch])

  const onSubmit: SubmitHandler<SignUpValues> = async (values): Promise<void> => {
    setIsSubmitting(true)
    setFormError(null)
    try {
      const reg = await register(values)
      setRegisteredEmail(values.email)
      setDevOtpHint(reg?.devOtp ?? null)
      if (reg?.devOtp && process.env.NODE_ENV === 'development') {
        console.info(`[DEV] Email verification code: ${reg.devOtp}`)
      }
      addToast({
        type: 'success',
        title: 'Verification email sent',
        message:
          reg?.devOtp && process.env.NODE_ENV === 'development'
            ? 'Your dev verification code is shown below this form.'
            : 'Check your email for a 6-digit verification code',
      })
    } catch (error: unknown) {
      const appError = error as { code?: string; message?: string }
      if (appError.code === 'INVALID_RESPONSE') {
        setFormError(appError.message ?? 'Could not reach the API. Check NEXT_PUBLIC_API_URL.')
      } else if (appError.code === 'CONFLICT') {
        setFormError('An account with this email already exists')
      } else {
        addToast({
          type: 'error',
          title: 'Sign up failed',
          message: appError.message ?? 'Please try again',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpChange = (index: number, value: string): void => {
    if (!/^\d?$/.test(value)) return
    const updated = [...otp]
    updated[index] = value
    setOtp(updated)
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const value = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!value) return
    event.preventDefault()
    const updated = value.split('')
    while (updated.length < 6) updated.push('')
    setOtp(updated)
  }

  const onOtpSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!registeredEmail) return
    const code = otp.join('')
    if (code.length !== 6) {
      setOtpError('Please enter the 6-digit code.')
      return
    }
    setIsSubmitting(true)
    try {
      await verifyEmail({ email: registeredEmail, otp: code })
      router.push('/onboarding')
    } catch {
      setOtpError('Invalid verification code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div>
          <input
            {...registerField('name')}
            aria-label="Name"
            type="text"
            placeholder="Your full name"
            className="h-11 w-full rounded-md border border-divider bg-card px-3 text-sm text-heading"
          />
          {errors.name ? <p className="mt-1 text-xs text-error">{errors.name.message}</p> : null}
        </div>

        <div>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select.Root value={field.value ?? ''} onValueChange={field.onChange}>
                <Select.Trigger
                  aria-label="Role"
                  className="flex h-11 w-full items-center justify-between rounded-md border border-divider bg-card px-3 text-sm text-heading"
                >
                  <Select.Value placeholder="Select your role" />
                  <Select.Icon>▾</Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="z-50 w-[var(--radix-select-trigger-width)] rounded-md border border-divider bg-card p-1 shadow-md">
                    <Select.Viewport>
                      <Select.Item value="FOUNDER" className="cursor-pointer rounded px-3 py-2 text-sm">
                        <Select.ItemText>Founder</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="DESIGNER" className="cursor-pointer rounded px-3 py-2 text-sm">
                        <Select.ItemText>Designer</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="DEVELOPER" className="cursor-pointer rounded px-3 py-2 text-sm">
                        <Select.ItemText>Developer</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="OTHER" className="cursor-pointer rounded px-3 py-2 text-sm">
                        <Select.ItemText>Other</Select.ItemText>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            )}
          />
          {errors.role ? <p className="mt-1 text-xs text-error">{errors.role.message}</p> : null}
        </div>

        <div>
          <input
            {...registerField('email')}
            aria-label="Email"
            type="email"
            placeholder="you@example.com"
            className="h-11 w-full rounded-md border border-divider bg-card px-3 text-sm text-heading"
          />
          {errors.email ? <p className="mt-1 text-xs text-error">{errors.email.message}</p> : null}
        </div>

        <div>
          <div className="relative">
            <input
              {...registerField('password')}
              aria-label="Password"
              type={showPassword ? 'text' : 'password'}
              className="h-11 w-full rounded-md border border-divider bg-card px-3 pr-10 text-sm text-heading"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 flex gap-1" aria-label="password-strength">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-2 w-8 rounded-full"
                style={{
                  backgroundColor:
                    index < passwordStrength
                      ? passwordStrength === 1
                        ? '#DC2626'
                        : passwordStrength === 2
                          ? '#D97706'
                          : '#16A34A'
                      : '#E8DFD0',
                }}
              />
            ))}
          </div>
          {errors.password ? <p className="mt-1 text-xs text-error">{errors.password.message}</p> : null}
        </div>

        <div>
          <label className="flex items-start gap-2 text-xs text-heading">
            <input type="checkbox" {...registerField('terms')} className="mt-1 rounded border-divider text-brand" />
            <span>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                Privacy Policy
              </a>
            </span>
          </label>
          {errors.terms ? <p className="mt-1 text-xs text-error">{errors.terms.message}</p> : null}
        </div>

        {formError ? <p className="text-xs text-error">{formError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:brightness-90 disabled:opacity-70"
        >
          {isSubmitting ? <LoadingSpinner className="text-white" /> : null}
          Create Account →
        </button>
      </form>

      {registeredEmail ? (
        <form className="space-y-3 rounded-card border border-divider bg-output p-4" onSubmit={onOtpSubmit}>
          {devOtpHint ? (
            <div className="rounded-md border border-brand/30 bg-brand/5 p-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Development code</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.35em] text-heading">{devOtpHint}</p>
              <p className="mt-2 text-[11px] text-muted">This is only included when the API runs in development mode.</p>
            </div>
          ) : null}
          <p className="text-xs text-heading">Enter the 6-digit verification code</p>
          <div className="flex gap-2">
            {otp.map((value, index) => (
              <input
                key={index}
                ref={(element) => {
                  otpRefs.current[index] = element
                }}
                value={value}
                onPaste={handleOtpPaste}
                onChange={(event) => handleOtpChange(index, event.target.value)}
                inputMode="numeric"
                maxLength={1}
                aria-label={`OTP digit ${index + 1}`}
                className="h-10 w-10 rounded-md border border-divider bg-card text-center text-sm font-semibold text-heading"
              />
            ))}
          </div>
          {otpError ? <p className="text-xs text-error">{otpError}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:brightness-90 disabled:opacity-70"
          >
            {isSubmitting ? <LoadingSpinner className="text-white" /> : null}
            Verify Email
          </button>
        </form>
      ) : null}
    </div>
  )
}
