'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuthStore } from '@/store/authStore'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

const GOOGLE_LOGO = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.7 14.5 2.8 12 2.8 7 2.8 3 6.9 3 12s4 9.2 9 9.2c5.2 0 8.7-3.7 8.7-8.8 0-.6-.1-1-.2-1.4H12z"
    />
  </svg>
)

interface OAuthPayload {
  type: 'GOOGLE_OAUTH_SUCCESS'
  user: {
    id: string
    email: string
    name: string
    role: 'user' | 'admin' | 'super_admin'
    plan: 'free' | 'pro' | 'team' | 'enterprise'
    onboardingDone?: boolean
  }
  isNewUser: boolean
}

export function GoogleOAuthButton(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false)
  const setUser = useAuthStore((state) => state.setUser)
  const router = useRouter()

  const oauthUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? ''
    return `${base}/auth/oauth/google/redirect`
  }, [])

  useEffect(() => {
    function onMessage(event: MessageEvent<OAuthPayload>): void {
      if (!event.data || event.data.type !== 'GOOGLE_OAUTH_SUCCESS') {
        return
      }
      setUser({
        id: event.data.user.id,
        email: event.data.user.email,
        name: event.data.user.name,
        avatarUrl: null,
        role: event.data.user.role,
        plan: event.data.user.plan,
        onboardingDone: event.data.user.onboardingDone ?? false,
      })
      setIsLoading(false)
      if (event.data.isNewUser) {
        router.push('/onboarding')
        return
      }
      router.push('/dashboard')
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [router, setUser])

  const onClick = (): void => {
    setIsLoading(true)
    const width = 600
    const height = 650
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    window.open(
      oauthUrl,
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`,
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-divider bg-card text-sm font-medium text-heading shadow-sm transition hover:bg-output disabled:opacity-70"
    >
      {isLoading ? <LoadingSpinner /> : GOOGLE_LOGO}
      <span>{isLoading ? 'Connecting...' : 'Continue with Google'}</span>
    </button>
  )
}
