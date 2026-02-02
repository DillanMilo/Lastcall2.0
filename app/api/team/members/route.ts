import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Get authenticated user and their org info
 */
async function getAuthenticatedUserOrg(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: userData, error: userError } = await supabase
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
    role: userData.role || 'member',
  };
}

/**
 * DELETE /api/team/members?id={memberId}
 * Remove a team member from the organization (Owner only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const userOrg = await getAuthenticatedUserOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can remove team members
    if (userOrg.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only owners can remove team members' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('id');

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Prevent owner from removing themselves
    if (memberId === userOrg.userId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify member belongs to user's org and get their info
    const { data: member, error: memberError } = await adminClient
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', memberId)
      .eq('org_id', userOrg.orgId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Prevent removing other owners
    if (member.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove an owner from the organization' },
        { status: 400 }
      );
    }

    // Remove from user_organizations table (multi-org support)
    const { error: userOrgError } = await adminClient
      .from('user_organizations')
      .delete()
      .eq('user_id', memberId)
      .eq('org_id', userOrg.orgId);

    if (userOrgError) {
      console.error('Error removing from user_organizations:', userOrgError);
      // Continue anyway - table might not exist or user might not be in it
    }

    // Update user record - remove org association
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        org_id: null,
        role: null,
      })
      .eq('id', memberId);

    if (updateError) {
      console.error('Error removing team member:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove team member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${member.full_name || member.email} has been removed from the team`,
      removedMember: {
        id: member.id,
        email: member.email,
        name: member.full_name,
      },
    });
  } catch (error) {
    console.error('Error in DELETE /api/team/members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
