import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create a response that we'll modify with updated auth cookies
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Use the modern getAll/setAll cookie pattern (required for @supabase/ssr 0.5+).
  // The old get/set/remove pattern created a NEW NextResponse on every set() call,
  // which discarded cookies written by previous calls. When Supabase refreshes tokens
  // it writes multiple cookie chunks — only the last chunk survived, corrupting the
  // session. This caused login loops and blank pages, especially in Chrome.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recreate the response with updated request cookies
          supabaseResponse = NextResponse.next({
            request,
          })
          // Set ALL cookies on the response at once (sent back to the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add logic between createServerClient and supabase.auth.getUser().
  // A simple mistake could make it very hard to debug auth issues.

  // Use getUser() instead of getSession() for proper server-side token validation.
  // getSession() only reads from cookies without verifying — getUser() validates the
  // token with Supabase Auth and handles token refresh correctly.
  let user = null
  try {
    const userPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Auth check timeout')), 5000)
    )

    const { data, error } = await Promise.race([userPromise, timeoutPromise]) as Awaited<typeof userPromise>

    if (error) {
      if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token') || error.message?.includes('Invalid Refresh Token')) {
        // Clear invalid tokens by signing out (properly clears all auth cookies)
        await Promise.race([
          supabase.auth.signOut(),
          new Promise<void>((resolve) => setTimeout(resolve, 3000))
        ])
      }
      user = null
    } else {
      user = data?.user ?? null
    }
  } catch (error: any) {
    if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token')) {
      await supabase.auth.signOut().catch(() => {})
    }
    user = null
  }

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  // NOTE: We intentionally do NOT redirect authenticated users away from /auth pages
  // in middleware. The client-side auth flow (signin page, AuthContext) handles this.
  // Doing it here causes a race condition: middleware detects the session before the
  // client-side redirect completes, creating a redirect loop.

  return supabaseResponse
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
