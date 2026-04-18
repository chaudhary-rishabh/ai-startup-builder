import { z } from 'zod'

// Shared password policy — used for register and reset-password
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: passwordSchema,
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['FOUNDER', 'DESIGNER', 'DEVELOPER', 'OTHER']),
})

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  // Optional TOTP code — required if user has 2FA enabled (enforced in service)
  totpCode: z.string().length(6).optional(),
  deviceInfo: z.object({ ua: z.string(), ip: z.string() }).optional(),
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
})

export const GoogleOAuthSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
})

export const Setup2FASchema = z.object({
  password: z.string().min(1, 'Password confirmation required'),
})

export const Verify2FASchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
})

// Admin login always requires TOTP — no optional here
export const AdminLoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
  totpCode: z.string().length(6, 'TOTP 2FA is required for admin login'),
})

// Inferred types — used by both React Hook Form (FE) and Hono route handlers (BE)
export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>
