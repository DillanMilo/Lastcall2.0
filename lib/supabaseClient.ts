import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const isBrowser = typeof window !== 'undefined';

/**
 * Browser clients use @supabase/ssr so auth state is mirrored into HTTP cookies.
 * Server-side imports fall back to a plain client (anon role) with session
 * persistence disabled.
 */
export const supabase = isBrowser
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      isSingleton: true,
    })
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
