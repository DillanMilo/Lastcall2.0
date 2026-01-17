"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'member';

export interface UserWithOrg {
  id: string;
  email: string;
  full_name?: string;
  org_id: string;
  role?: UserRole;
  organization?: {
    id: string;
    name: string;
    subscription_tier: 'free' | 'starter' | 'growth' | 'pro' | 'enterprise' | 'trial';
    subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    subscription_period_end?: string;
    payment_failed_at?: string;
    canceled_at?: string;
    is_read_only?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  userWithOrg: UserWithOrg | null;
  orgId: string | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userWithOrg, setUserWithOrg] = useState<UserWithOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  const bootstrapViaServer = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/bootstrap', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        console.error('Bootstrap API error:', payload?.error || response.statusText);
        return null;
      }

      if (!payload?.user) {
        console.error('Bootstrap API error: invalid response payload');
        return null;
      }

      const combined: UserWithOrg = {
        ...payload.user,
        organization: payload.organization ?? undefined,
      };

      setUserWithOrg(combined);
      setOrgId(payload.user.org_id);
      return combined;
    } catch (error) {
      console.error('Bootstrap API error:', error);
      return null;
    }
  }, []);

  const fetchUserWithOrg = useCallback(async (userId: string) => {
    try {
      const { data: userRecord, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user with org:', error?.message || error);
        setLoading(false);
        return;
      }

      // Check for invalid/placeholder org_ids
      const invalidOrgIds = ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'];
      const hasValidOrgId = userRecord?.org_id && !invalidOrgIds.includes(userRecord.org_id);

      if (!userRecord || !hasValidOrgId) {
        // Try bootstrap to fix the user's org
        const bootstrapResult = await bootstrapViaServer();
        if (!bootstrapResult && userRecord) {
          // Set user without org so UI doesn't break
          setUserWithOrg({ ...userRecord, organization: undefined });
        }
        setLoading(false);
        return;
      }

      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userRecord.org_id)
        .maybeSingle();

      if (orgError) {
        console.error('Error fetching organization:', orgError.message || orgError);
      }

      // If org doesn't exist, try bootstrap
      if (!organization) {
        const bootstrapResult = await bootstrapViaServer();
        if (!bootstrapResult) {
          setUserWithOrg({ ...userRecord, organization: undefined });
        }
        setLoading(false);
        return;
      }

      setUserWithOrg({
        ...userRecord,
        organization: organization ?? undefined,
      });
      setOrgId(userRecord.org_id);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchUserWithOrg:', error);
      setLoading(false);
    }
  }, [bootstrapViaServer]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      // Failsafe timeout - if auth takes longer than 10 seconds, something is wrong
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Auth initialization timed out - clearing stale state');
          setLoading((currentLoading) => {
            if (currentLoading) {
              // Only clear if still loading
              setUser(null);
              setUserWithOrg(null);
              setOrgId(null);
              // Clear potentially corrupted auth state
              supabase.auth.signOut().catch(() => {});
              return false;
            }
            return currentLoading;
          });
        }
      }, 10000);

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        // If there's a session error, clear state and continue
        if (sessionError) {
          console.error('Session error:', sessionError.message);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await fetchUserWithOrg(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          await fetchUserWithOrg(session.user.id);
        } else {
          setUser(null);
          setUserWithOrg(null);
          setOrgId(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchUserWithOrg]);

  const signOut = async () => {
    try {
      // Clear local state first
      setUser(null);
      setUserWithOrg(null);
      setOrgId(null);

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Sign out error:', error.message);
        // Even if there's an error, we've already cleared local state
        // so the user will be effectively signed out locally
      }
    } catch (error) {
      console.error('Sign out exception:', error);
      // Force clear on error
      setUser(null);
      setUserWithOrg(null);
      setOrgId(null);
    }
  };

  const refetchUser = () => {
    if (user?.id) {
      fetchUserWithOrg(user.id);
    }
  };

  const isAdmin = userWithOrg?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      userWithOrg,
      orgId,
      loading,
      isAdmin,
      signOut,
      refetchUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
