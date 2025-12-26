"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';

export interface UserWithOrg {
  id: string;
  email: string;
  full_name?: string;
  org_id: string;
  organization?: {
    id: string;
    name: string;
    subscription_tier: string;
  };
}

interface AuthContextType {
  user: User | null;
  userWithOrg: UserWithOrg | null;
  orgId: string | null;
  loading: boolean;
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

  const createUserAndOrg = useCallback(async (userId: string) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return null;
      }

      const orgName = `${authUser.email?.split('@')[0] || 'User'}'s Organization`;

      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          subscription_tier: 'growth',
        })
        .select('*')
        .single();

      if (orgError) {
        if (
          typeof orgError.message === 'string' &&
          orgError.message.toLowerCase().includes('row-level security')
        ) {
          return await bootstrapViaServer();
        }
        console.error('Error creating organization:', orgError.message || orgError);
        return null;
      }

      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || null,
          org_id: newOrg.id,
        })
        .select('*')
        .single();

      if (userError) {
        console.error('Error creating user record:', userError.message || userError);
        return null;
      }

      const combined: UserWithOrg = {
        ...newUser,
        organization: newOrg ?? undefined,
      };

      setUserWithOrg(combined);
      setOrgId(newUser.org_id);
      return combined;
    } catch (error) {
      console.error('Error creating user and org:', error);
      return null;
    }
  }, [bootstrapViaServer]);

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

      if (!userRecord || !userRecord.org_id) {
        await createUserAndOrg(userId);
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
  }, [createUserAndOrg]);

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
    await supabase.auth.signOut();
  };

  const refetchUser = () => {
    if (user?.id) {
      fetchUserWithOrg(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userWithOrg,
      orgId,
      loading,
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
