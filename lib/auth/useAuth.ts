import { useState, useEffect } from 'react';
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userWithOrg, setUserWithOrg] = useState<UserWithOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchUserWithOrg(session.user.id);
        // fetchUserWithOrg will set loading to false when done
      } else {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchUserWithOrg(session.user.id);
          // fetchUserWithOrg will set loading to false when done
        } else {
          setUser(null);
          setUserWithOrg(null);
          setOrgId(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserWithOrg = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('id', userId)
        .single();

      if (error) {
        // If user doesn't exist in users table, create a basic record
        if (error.code === 'PGRST116') {
          // User not found - get auth user to create record
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            // Create a default organization for the user
            const { data: newOrg, error: orgError } = await supabase
              .from('organizations')
              .insert({
                name: `${authUser.email?.split('@')[0] || 'User'}'s Organization`,
                subscription_tier: 'growth',
              })
              .select()
              .single();

            if (orgError) {
              console.error('Error creating organization:', orgError);
              setLoading(false);
              return;
            }

            // Create user record with the new organization
            const { data: newUser, error: userError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: authUser.email || '',
                full_name: authUser.user_metadata?.full_name || null,
                org_id: newOrg.id,
              })
              .select(`
                *,
                organization:organizations(*)
              `)
              .single();

            if (userError) {
              console.error('Error creating user:', userError);
              setLoading(false);
              return;
            }

            setUserWithOrg(newUser);
            setOrgId(newUser.org_id);
            setLoading(false);
            return;
          }
        }
        console.error('Error fetching user with org:', error);
        setLoading(false);
        return;
      }

      setUserWithOrg(data);
      setOrgId(data.org_id);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchUserWithOrg:', error);
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    userWithOrg,
    orgId,
    loading,
    signOut,
    refetchUser: () => user?.id && fetchUserWithOrg(user.id)
  };
}
