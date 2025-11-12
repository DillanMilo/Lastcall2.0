/**
 * Get the site URL for email redirects
 * Uses window.location.origin in browser (most reliable)
 * Falls back to environment variable for server-side
 */
export function getSiteUrl(): string {
  // In browser/client-side, always use the current origin
  // This ensures the redirect URL matches where the user actually is
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side: use environment variable or fallback
  // This is used for server-side rendering or API routes
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}
