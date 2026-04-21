const ACCESS_KEY = 'asb_access_token'
const REFRESH_KEY = 'asb_refresh_token'

/**
 * Persists access + refresh tokens for API calls (sessionStorage) and sets the
 * `access_token` cookie so Next.js middleware can gate server-rendered routes.
 */
export function setSessionTokens(access: string, refresh: string, expiresInSec: number): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(ACCESS_KEY, access)
  sessionStorage.setItem(REFRESH_KEY, refresh)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  document.cookie = `access_token=${encodeURIComponent(access)}; path=/; max-age=${expiresInSec}; SameSite=Lax${secure}`
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(REFRESH_KEY)
}

export function clearSessionTokens(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  document.cookie = 'access_token=; path=/; max-age=0'
}
