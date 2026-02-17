import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export type UserRole = 'owner' | 'admin' | 'member';

export interface AuthenticatedUser {
  userId: string;
  email: string | undefined;
  orgId: string;
  role: UserRole;
}

/**
 * Get authenticated user with their org info and role
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const { supabase } = createRouteHandlerClient(request);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Use admin client to get user data including role
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await adminClient
    .from('users')
    .select('org_id, role')
    .eq('id', user.id)
    .single();

  if (userError || !userData?.org_id) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    orgId: userData.org_id,
    role: (userData.role as UserRole) || 'member',
  };
}

/**
 * Check if user is an owner
 */
export function isOwner(user: AuthenticatedUser): boolean {
  return user.role === 'owner';
}

/**
 * Check if user is an admin (includes owners)
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'owner' || user.role === 'admin';
}

/**
 * Require owner role - returns error response if not owner
 */
export function requireOwner(user: AuthenticatedUser): NextResponse | null {
  if (!isOwner(user)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Owner access required for this action'
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Require admin role (owner or admin) - returns error response if not admin
 */
export function requireAdmin(user: AuthenticatedUser): NextResponse | null {
  if (!isAdmin(user)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Admin access required for this action'
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Helper to get admin client for database operations
 */
export function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
