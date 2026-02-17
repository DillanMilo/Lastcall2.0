import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/organizations/switch
 * Switch the user's active organization
 */
export async function POST(request: NextRequest) {
  const { supabase, jsonResponse } = createRouteHandlerClient(request);

  try {
    if (!serviceRoleKey) {
      return jsonResponse(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get authenticated user

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { org_id } = await request.json();

    if (!org_id) {
      return jsonResponse(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify user belongs to this organization
    const { data: membership, error: membershipError } = await adminClient
      .from('user_organizations')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .maybeSingle();

    if (membershipError || !membership) {
      return jsonResponse(
        { error: 'You do not belong to this organization' },
        { status: 403 }
      );
    }

    // Deactivate all user's org memberships
    await adminClient
      .from('user_organizations')
      .update({ is_active: false })
      .eq('user_id', user.id);

    // Activate the selected organization
    await adminClient
      .from('user_organizations')
      .update({ is_active: true })
      .eq('user_id', user.id)
      .eq('org_id', org_id);

    // Update the user's primary org_id and role in the users table
    const { error: userUpdateError } = await adminClient
      .from('users')
      .update({
        org_id: org_id,
        role: membership.role,
      })
      .eq('id', user.id);

    if (userUpdateError) {
      console.error('Error updating user org:', userUpdateError);
      return jsonResponse(
        { error: 'Failed to switch organization' },
        { status: 500 }
      );
    }

    // Get the organization data
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('*')
      .eq('id', org_id)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return jsonResponse(
        { error: 'Failed to fetch organization data' },
        { status: 500 }
      );
    }

    return jsonResponse({
      success: true,
      message: `Switched to ${organization.name}`,
      organization,
      role: membership.role,
    });
  } catch (error) {
    console.error('Error switching organization:', error);
    return jsonResponse(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
