import { supabase } from '@/lib/supabaseClient';

/**
 * Get the organization ID for the currently authenticated user
 * Returns null if user is not authenticated or doesn't have an org
 */
export async function getUserOrgId(): Promise<string | null> {
  try {
    // Get current user from Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return null;
    }

    // Get user's organization from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return null;
    }

    return userData.org_id;
  } catch (error) {
    console.error('Error getting user organization:', error);
    return null;
  }
}

/**
 * Get full user data including organization info
 */
export async function getUserWithOrg() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return null;
    }

    // Get user data with organization details
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        organization:organizations(*)
      `)
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user with org:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserWithOrg:', error);
    return null;
  }
}


