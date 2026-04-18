import api from '@/lib/axios'

export interface RegisterPayload {
  email: string
  password: string
  name: string
  role: 'FOUNDER' | 'DESIGNER' | 'DEVELOPER' | 'OTHER'
}

export interface LoginPayload {
  email: string
  password: string
}

export interface GoogleOAuthPayload {
  code: string
  redirectUri: string
}

interface UserPayload {
  id: string
  email: string
  name: string
  role: string
  plan: string
}

export async function register(payload: RegisterPayload): Promise<{ userId: string; message: string }> {
  const res = await api.post<{ data: { userId: string; message: string } }>('/auth/register', payload)
  return res.data.data
}

export async function login(payload: LoginPayload): Promise<{ user: UserPayload; requiresTwoFactor?: boolean; tempToken?: string }> {
  const res = await api.post<{ data: { user: UserPayload; requiresTwoFactor?: boolean; tempToken?: string } }>(
    '/auth/login',
    payload,
  )
  return res.data.data
}

export async function loginWithTotp(payload: {
  tempToken: string
  totpCode: string
}): Promise<{ user: UserPayload }> {
  const res = await api.post<{ data: { user: UserPayload } }>('/auth/login/totp', payload)
  return res.data.data
}

export async function googleOAuth(
  payload: GoogleOAuthPayload,
): Promise<{ user: UserPayload; isNewUser: boolean }> {
  const res = await api.post<{ data: { user: UserPayload; isNewUser: boolean } }>('/auth/oauth/google', payload)
  return res.data.data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function refreshToken(): Promise<void> {
  await api.post('/auth/refresh')
}

export async function getMe(): Promise<{
  id: string
  email: string
  name: string
  role: string
  plan: string
  onboardingDone: boolean
}> {
  const res = await api.get<{
    data: {
      id: string
      email: string
      name: string
      role: string
      plan: string
      onboardingDone: boolean
    }
  }>('/auth/me')
  return res.data.data
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email })
}

export async function resetPassword(payload: { token: string; newPassword: string }): Promise<void> {
  await api.post('/auth/reset-password', payload)
}

export async function verifyEmail(payload: { email: string; otp: string }): Promise<void> {
  await api.post('/auth/verify-email', payload)
}
