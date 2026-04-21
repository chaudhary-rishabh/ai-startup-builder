import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/', '/auth/callback']
const ONBOARDING_PATH = '/onboarding'

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Same-origin axios calls must not hit this guard when NEXT_PUBLIC_API_URL is misconfigured
  // (e.g. POST /auth/register would otherwise 307 and break JSON parsing).
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  const token = request.cookies.get('access_token')?.value
  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  try {
    if (process.env.NODE_ENV !== 'production' && token.startsWith('e2e:')) {
      const onboardingDone = token.includes('onboardingDone=true')
      if (!onboardingDone && pathname !== ONBOARDING_PATH && pathname !== '/dashboard') {
        return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url))
      }
      if (onboardingDone && pathname === ONBOARDING_PATH) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-id', 'e2e-user')
      requestHeaders.set('x-user-role', 'user')
      requestHeaders.set('x-user-plan', 'free')
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    const publicKeyBase64 = process.env.JWT_PUBLIC_KEY_BASE64 ?? ''
    const publicKeyDer = decodeBase64(publicKeyBase64)
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const { payload } = await jwtVerify(token, publicKey)

    const isOnboardingDone = payload.onboardingDone as boolean | undefined
    if (!isOnboardingDone && pathname !== ONBOARDING_PATH) {
      return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url))
    }
    if (isOnboardingDone && pathname === ONBOARDING_PATH) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', String(payload.sub ?? ''))
    requestHeaders.set('x-user-role', String(payload.role ?? ''))
    requestHeaders.set('x-user-plan', String(payload.plan ?? ''))

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.delete('access_token')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
