import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Note: Using placeholder values to allow UI development without backend setup
// Add real credentials to .env.local for full functionality
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Handle refresh token errors gracefully
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
  },
});

/**
 * Keep Supabase session cookies in sync so middleware/server routes
 * can read the auth state. LocalStorage remains the primary store,
 * but we mirror the tokens into `sb-access-token` / `sb-refresh-token`.
 */
if (typeof window !== 'undefined') {
  const SECURE_CONTEXT = window.location.protocol === 'https:';

  const setCookie = (name: string, value: string, maxAgeSeconds: number) => {
    const encoded = encodeURIComponent(value);
    const directives = [
      `${name}=${encoded}`,
      'Path=/',
      `Max-Age=${maxAgeSeconds}`,
      'SameSite=Lax',
    ];

    if (SECURE_CONTEXT) {
      directives.push('Secure');
    }

    document.cookie = directives.join('; ');
  };

  const removeCookie = (name: string) => {
    const directives = [
      `${name}=`,
      'Path=/',
      'Max-Age=0',
      'SameSite=Lax',
    ];

    if (SECURE_CONTEXT) {
      directives.push('Secure');
    }

    document.cookie = directives.join('; ');
  };

  const syncSessionCookies = (session: Session | null) => {
    if (!session) {
      removeCookie('sb-access-token');
      removeCookie('sb-refresh-token');
      return;
    }

    setCookie('sb-access-token', session.access_token, session.expires_in ?? 3600);

    if (session.refresh_token) {
      // Refresh tokens live longer than access tokens (~90 days by default)
      const ninetyDaysInSeconds = 60 * 60 * 24 * 90;
      setCookie('sb-refresh-token', session.refresh_token, ninetyDaysInSeconds);
    }
  };

  // Initial sync on page load
  supabase.auth.getSession().then(({ data }) => {
    syncSessionCookies(data.session ?? null);
  });

  // Keep cookies updated whenever auth state changes
  supabase.auth.onAuthStateChange((_event, session) => {
    syncSessionCookies(session ?? null);
  });
}
