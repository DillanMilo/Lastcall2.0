"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'admin' | 'member';

export interface Organization {
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
  billing_exempt?: boolean;
}

export interface OrgMembership {
  org_id: string;
  role: UserRole;
  is_active: boolean;
  organization: Organization;
}

export interface UserWithOrg {
  id: string;
  email: string;
  full_name?: string;
  org_id: string;
  role?: UserRole;
  organization?: Organization;
}

interface AuthContextType {
  user: User | null;
  userWithOrg: UserWithOrg | null;
  orgId: string | null;
  loading: boolean;
  // Role checks - hierarchical permissions
  isOwner: boolean;    // Only owners
  isAdmin: boolean;    // Owners + Admins
  isMember: boolean;   // Everyone (owners, admins, members)
  role: UserRole | null;
  organizations: OrgMembership[];
  switchOrganization: (orgId: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refetchUser: () => void;
  // Permission helpers
  canManageBilling: boolean;      // Owner only
  canInviteMembers: boolean;      // Owner + Admin
  canSwitchStores: boolean;       // Owner + Admin (multi-store)
  canManageSettings: boolean;     // Owner + Admin
  canViewInventory: boolean;      // Everyone
  canEditInventory: boolean;      // Everyone
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userWithOrg, setUserWithOrg] = useState<UserWithOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrgMembership[]>([]);

  const bootstrapViaServer = useCallback(async (): Promise<{ user: UserWithOrg | null; pendingInvite?: boolean }> => {
    try {
      const response = await fetch('/api/auth/bootstrap', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        console.error('Bootstrap API error:', payload?.error || response.statusText);
        return { user: null };
      }

      if (!payload?.user) {
        console.error('Bootstrap API error: invalid response payload');
        return { user: null };
      }

      // Check if user has a pending invite - they need to accept it first
      if (payload.pendingInvite) {
        console.log('User has pending invite, checking for invite token...');
        const pendingInviteToken = typeof window !== 'undefined'
          ? localStorage.getItem("pendingInviteToken")
          : null;

        if (pendingInviteToken) {
          // Redirect to invite page to accept
          console.log('Redirecting to accept pending invite...');
          window.location.href = `/auth/invite?token=${pendingInviteToken}`;
          return { user: null, pendingInvite: true };
        }

        // No token stored, check API for pending invite
        try {
          const inviteResponse = await fetch(`/api/team/invites/pending?email=${encodeURIComponent(payload.user.email)}`);
          const inviteData = await inviteResponse.json();
          if (inviteData.token) {
            console.log('Found pending invite via API, redirecting...');
            window.location.href = `/auth/invite?token=${inviteData.token}`;
            return { user: null, pendingInvite: true };
          }
        } catch (e) {
          console.error('Error checking for pending invite:', e);
        }
      }

      const combined: UserWithOrg = {
        ...payload.user,
        organization: payload.organization ?? undefined,
      };

      setUserWithOrg(combined);
      setOrgId(payload.user.org_id);

      // Set organizations list from bootstrap response
      if (payload.organizations && Array.isArray(payload.organizations)) {
        setOrganizations(payload.organizations);
      }

      return { user: combined };
    } catch (error) {
      console.error('Bootstrap API error:', error);
      return { user: null };
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
      const invalidOrgIds = [
        '00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000001',
      ];

      const hasValidOrgId = userRecord?.org_id && !invalidOrgIds.includes(userRecord.org_id);

      if (!userRecord || !hasValidOrgId) {
        // User exists but has no valid org - try bootstrap to fix it
        console.log('User has no valid org_id, attempting bootstrap...');
        const bootstrapResult = await bootstrapViaServer();

        // If user has pending invite, bootstrap will redirect them - don't continue
        if (bootstrapResult.pendingInvite) {
          return;
        }

        if (!bootstrapResult.user) {
          // Bootstrap failed - set user without org so they can at least see something
          if (userRecord) {
            setUserWithOrg({
              ...userRecord,
              organization: undefined,
            });
          }
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

      // If organization doesn't exist, try bootstrap
      if (!organization) {
        console.log('Organization not found, attempting bootstrap...');
        const bootstrapResult = await bootstrapViaServer();

        // If user has pending invite, bootstrap will redirect them - don't continue
        if (bootstrapResult.pendingInvite) {
          return;
        }

        if (!bootstrapResult.user) {
          setUserWithOrg({
            ...userRecord,
            organization: undefined,
          });
        }
        setLoading(false);
        return;
      }

      // ALWAYS fetch the user's organizations list for multi-org support
      // This enables the organization switcher for users with multiple orgs
      const { data: userOrgs, error: userOrgsError } = await supabase
        .from('user_organizations')
        .select(`
          org_id,
          role,
          is_active,
          organizations (
            id,
            name,
            subscription_tier,
            subscription_status,
            stripe_customer_id,
            stripe_subscription_id,
            subscription_period_end,
            payment_failed_at,
            canceled_at,
            is_read_only,
            billing_exempt
          )
        `)
        .eq('user_id', userId);

      if (userOrgsError) {
        console.error('Error fetching user organizations:', userOrgsError.message || userOrgsError);
      }

      // Transform and set organizations list
      if (userOrgs && userOrgs.length > 0) {
        const orgsList: OrgMembership[] = userOrgs.map(uo => ({
          org_id: uo.org_id,
          role: uo.role as UserRole,
          is_active: uo.is_active,
          organization: (Array.isArray(uo.organizations) ? uo.organizations[0] : uo.organizations) as Organization,
        }));
        setOrganizations(orgsList);
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
          // Check "Remember Me" preference
          // If user has an active session (same browser session) or checked "Remember Me", allow login
          // Otherwise, sign them out (they didn't want to be remembered)
          const hasActiveSession = sessionStorage.getItem("activeSession") === "true";
          const rememberMe = localStorage.getItem("rememberMe") === "true";

          // Don't apply "Remember Me" check in these cases:
          // 1. Auth pages handle their own session management
          // 2. Email verification flows (hash params with tokens)
          // 3. Pending invite flows (user is accepting an invite)
          const isAuthPage = typeof window !== 'undefined' &&
            (window.location.pathname.startsWith('/auth/') ||
             window.location.hash.includes('access_token'));
          const hasPendingInvite = typeof window !== 'undefined' &&
            localStorage.getItem("pendingInviteToken");

          if (!hasActiveSession && !rememberMe && !isAuthPage && !hasPendingInvite) {
            // User didn't want to be remembered and this is a new browser session
            console.log('Session found but user did not check "Remember Me" - signing out');
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          // Mark this as an active session for page refreshes
          sessionStorage.setItem("activeSession", "true");

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
      setOrganizations([]);

      // Clear remember me and session flags
      localStorage.removeItem("rememberMe");
      sessionStorage.removeItem("activeSession");

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Sign out error:', error.message);
      }
    } catch (error) {
      console.error('Sign out exception:', error);
      // Force clear on error
      setUser(null);
      setUserWithOrg(null);
      setOrgId(null);
      setOrganizations([]);
      localStorage.removeItem("rememberMe");
      sessionStorage.removeItem("activeSession");
    }
  };

  const refetchUser = () => {
    if (user?.id) {
      fetchUserWithOrg(user.id);
    }
  };

  const switchOrganization = async (newOrgId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ org_id: newOrgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Switch org error:', data.error);
        return false;
      }

      // Update local state with the new organization
      if (data.organization) {
        setOrgId(newOrgId);
        setUserWithOrg(prev => prev ? {
          ...prev,
          org_id: newOrgId,
          role: data.role,
          organization: data.organization,
        } : null);

        // Update organizations list to reflect new active state
        setOrganizations(prev => prev.map(org => ({
          ...org,
          is_active: org.org_id === newOrgId,
        })));
      }

      return true;
    } catch (error) {
      console.error('Switch organization error:', error);
      return false;
    }
  };

  // Role and permission calculations
  const role = (userWithOrg?.role as UserRole) || null;
  const isOwner = role === 'owner';
  const isAdmin = role === 'owner' || role === 'admin';  // Owners have admin privileges
  const isMember = !!role;  // Any role means they're a member of the org

  // Permission helpers based on role hierarchy
  // Owner: Full access to everything
  // Admin: Can manage team, settings, switch stores - but NOT billing
  // Member: Can view/edit inventory, see reports - but NOT manage team or settings
  const canManageBilling = isOwner;
  const canInviteMembers = isAdmin;  // Owner + Admin
  const canSwitchStores = isAdmin;   // Owner + Admin (for multi-store orgs)
  const canManageSettings = isAdmin; // Owner + Admin
  const canViewInventory = isMember; // Everyone
  const canEditInventory = isMember; // Everyone

  return (
    <AuthContext.Provider value={{
      user,
      userWithOrg,
      orgId,
      loading,
      isOwner,
      isAdmin,
      isMember,
      role,
      organizations,
      switchOrganization,
      signOut,
      refetchUser,
      canManageBilling,
      canInviteMembers,
      canSwitchStores,
      canManageSettings,
      canViewInventory,
      canEditInventory,
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
