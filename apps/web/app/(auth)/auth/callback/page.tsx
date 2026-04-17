'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

import { googleOAuth } from '@/api/auth.api'

export default function OAuthCallbackPage(): JSX.Element {
  const params = useSearchParams()

  useEffect(() => {
    const code = params.get('code')
    if (!code) {
      window.close()
      return
    }
    void (async () => {
      try {
        const data = await googleOAuth({
          code,
          redirectUri: `${window.location.origin}/auth/callback`,
        })
        window.opener?.postMessage(
          {
            type: 'GOOGLE_OAUTH_SUCCESS',
            user: data.user,
            isNewUser: data.isNewUser,
          },
          window.location.origin,
        )
      } finally {
        window.close()
      }
    })()
  }, [params])

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <p className="text-sm text-heading">Completing Google sign in...</p>
    </main>
  )
}
