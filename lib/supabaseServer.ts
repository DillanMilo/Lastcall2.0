import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client for API route handlers with the modern getAll/setAll
 * cookie pattern (required for @supabase/ssr 0.5+).
 *
 * Returns the client and a `jsonResponse` helper that attaches any refreshed
 * auth cookies to whichever NextResponse is returned.
 *
 * The old get/set/remove pattern had TWO bugs:
 * 1. Each set() created a new NextResponse, discarding cookies from prior calls.
 *    When Supabase refreshes tokens it writes multiple cookie chunks — only the
 *    last chunk survived, corrupting the session.
 * 2. Cookies were set on a NextResponse.next() that was never returned. Route
 *    handlers return NextResponse.json(), so refreshed cookies were always lost.
 */
export function createRouteHandlerClient(request: NextRequest) {
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((c) => pendingCookies.push(c));
      },
    },
  });

  /** Create a NextResponse.json() with any pending auth cookies attached. */
  function jsonResponse(body: unknown, init?: ResponseInit) {
    const res = NextResponse.json(body, init);
    pendingCookies.forEach(({ name, value, options }) =>
      res.cookies.set(name, value, options as Record<string, unknown>)
    );
    return res;
  }

  return { supabase, jsonResponse };
}
