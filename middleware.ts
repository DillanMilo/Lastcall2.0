import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Try to get session, but handle errors gracefully with a timeout
  // to prevent 504 Gateway Timeout on slow connections (especially mobile)
  let session = null
  try {
    const sessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Auth session timeout')), 5000)
    )

    const { data, error } = await Promise.race([sessionPromise, timeoutPromise]) as Awaited<typeof sessionPromise>

    // If there's a refresh token error, clear the session and continue
    if (error) {
      // Check if it's a refresh token error
      if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token') || error.message?.includes('Invalid Refresh Token')) {
        // Clear invalid tokens by signing out with timeout (this properly clears all auth cookies)
        await Promise.race([
          supabase.auth.signOut(),
          new Promise<void>((resolve) => setTimeout(resolve, 3000))
        ])
        // Continue without session (user will need to sign in again)
        session = null
      } else {
        // For other errors, log but don't block
        console.error('Auth error in middleware:', error.message)
        session = null
      }
    } else {
      session = data?.session ?? null
    }
  } catch (error: any) {
    // Catch any unexpected errors (including timeouts) and continue
    if (error?.message === 'Auth session timeout') {
      console.warn('Middleware auth check timed out - proceeding without session')
    } else if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token')) {
      await supabase.auth.signOut().catch(() => {})
    }
    session = null
  }

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  // NOTE: We intentionally do NOT redirect authenticated users away from /auth pages
  // in middleware. The client-side auth flow (signin page, AuthContext) handles this.
  // Doing it here causes a race condition: middleware detects the session before the
  // client-side redirect completes, creating a redirect loop.

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
