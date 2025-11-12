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

  // Try to get session, but handle errors gracefully
  let session = null
  try {
    const { data, error } = await supabase.auth.getSession()
    
    // If there's a refresh token error, clear the session and continue
    if (error) {
      // Check if it's a refresh token error
      if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token') || error.message?.includes('Invalid Refresh Token')) {
        // Clear invalid tokens by signing out (this properly clears all auth cookies)
        await supabase.auth.signOut()
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
    // Catch any unexpected errors and continue
    // If it's a refresh token error, clear it
    if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token')) {
      await supabase.auth.signOut().catch(() => {})
    }
    session = null
  }

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (request.nextUrl.pathname.startsWith('/auth') && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

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
