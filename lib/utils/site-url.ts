/**
 * Get the site URL for email redirects
 * Uses NEXT_PUBLIC_SITE_URL in production, falls back to window.location.origin in development
 */
export function getSiteUrl(): string {
  // In production, use the environment variable
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // In development/browser, use window.location.origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Fallback for server-side rendering
  return 'http://localhost:3000';
}
