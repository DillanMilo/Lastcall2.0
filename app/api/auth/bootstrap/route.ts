import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' },
      { status: 500 }
    );
  }

  const { supabase, jsonResponse } = createRouteHandlerClient(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const buildResponse = async (userRecord: { id: string; email?: string; org_id?: string | null; [key: string]: unknown }) => {
    let organization = null;
    let organizations: Array<{ org_id: string; role: string; is_active: boolean; organization: { id: string; name: string; subscription_tier: string } }> = [];

    // Fetch all organizations the user belongs to
    const { data: userOrgs } = await adminClient
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
          is_read_only
        )
      `)
      .eq('user_id', userRecord.id);

    if (userOrgs && userOrgs.length > 0) {
      organizations = userOrgs.map(uo => ({
        org_id: uo.org_id,
        role: uo.role,
        is_active: uo.is_active,
        organization: Array.isArray(uo.organizations) ? uo.organizations[0] : uo.organizations,
      }));

      // Get the active organization
      const activeOrg = organizations.find(o => o.is_active);
      if (activeOrg) {
        organization = activeOrg.organization;
      }
    } else if (userRecord?.org_id) {
      // Fallback for users not yet in user_organizations table
      const { data: orgData } = await adminClient
        .from('organizations')
        .select('*')
        .eq('id', userRecord.org_id)
        .maybeSingle();

      organization = orgData || null;
    }

    return jsonResponse({
      success: true,
      user: userRecord,
      organization,
      organizations, // All orgs user belongs to
    });
  };

  const getUserById = async () => {
    return adminClient
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
  };

  const {
    data: initialUser,
    error: existingError,
  } = await getUserById();
  
  let existingUser = initialUser;

  if (existingError) {
    console.error('Error checking existing user:', existingError);
    return jsonResponse(
      { error: existingError.message || 'Failed to check user' },
      { status: 500 }
    );
  }

  // If no row by auth UID, try matching by email (handles seed data with different id)
  if (!existingUser && user.email) {
    const {
      data: userByEmail,
      error: emailError,
    } = await adminClient
      .from('users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    if (emailError) {
      console.error('Error checking user by email:', emailError);
      return jsonResponse(
        { error: emailError.message || 'Failed to check user by email' },
        { status: 500 }
      );
    }

    if (userByEmail) {
      if (userByEmail.id !== user.id) {
        const {
          data: migratedUser,
          error: migrateError,
        } = await adminClient
          .from('users')
          .update({ id: user.id })
          .eq('id', userByEmail.id)
          .select('*')
          .single();

        if (migrateError) {
          console.error('Error migrating user record to auth UID:', migrateError);
          return jsonResponse(
            { error: migrateError.message || 'Failed to migrate existing user' },
            { status: 500 }
          );
        }

        existingUser = migratedUser;
      } else {
        existingUser = userByEmail;
      }
    }
  }

  // Check for valid org_id (not placeholder values)
  const invalidOrgIds = [
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
  ];
  const hasValidOrgId = existingUser?.org_id && !invalidOrgIds.includes(existingUser.org_id);

  if (existingUser && hasValidOrgId) {
    return buildResponse(existingUser);
  }

  // Check if there's a pending invite for this user's email
  // If so, don't create an org - let them accept the invite first
  if (user.email) {
    const { data: pendingInvite } = await adminClient
      .from('team_invites')
      .select('id, org_id')
      .eq('email', user.email.toLowerCase())
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (pendingInvite) {
      // User has a pending invite - AUTO-ACCEPT it during bootstrap
      // This ensures the user gets assigned to the org immediately
      console.log('Auto-accepting pending invite during bootstrap for:', user.email);

      // Get the full invite details
      const { data: fullInvite } = await adminClient
        .from('team_invites')
        .select('id, org_id, role, email')
        .eq('id', pendingInvite.id)
        .single();

      if (fullInvite) {
        // Create or update user with the invite's org_id
        const { data: newUser, error: userError } = await adminClient
          .from('users')
          .upsert({
            id: user.id,
            email: user.email || '',
            full_name: (user.user_metadata as { full_name?: string } | null)?.full_name || null,
            org_id: fullInvite.org_id, // Set to invite's org immediately!
            role: fullInvite.role || 'member',
          }, { onConflict: 'id' })
          .select('*')
          .single();

        if (userError) {
          console.error('Error creating user record for invited user:', userError);
          return jsonResponse(
            { error: userError.message || 'Failed to create user' },
            { status: 500 }
          );
        }

        // Add to user_organizations table
        await adminClient
          .from('user_organizations')
          .upsert({
            user_id: user.id,
            org_id: fullInvite.org_id,
            role: fullInvite.role || 'member',
            is_active: true,
            joined_at: new Date().toISOString(),
          }, { onConflict: 'user_id,org_id' });

        // Mark invite as accepted
        await adminClient
          .from('team_invites')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', fullInvite.id);

        console.log('Successfully auto-accepted invite, user org_id:', newUser?.org_id);

        // Get the organization details
        const { data: orgData } = await adminClient
          .from('organizations')
          .select('*')
          .eq('id', fullInvite.org_id)
          .single();

        return jsonResponse({
          success: true,
          user: newUser,
          organization: orgData,
          inviteAccepted: true, // Signal that invite was auto-accepted
        });
      }

      // Fallback if invite details couldn't be fetched - create without org
      if (!existingUser) {
        const { data: newUser, error: userError } = await adminClient
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: (user.user_metadata as { full_name?: string } | null)?.full_name || null,
            org_id: null,
            role: 'member',
          })
          .select('*')
          .single();

        if (userError) {
          console.error('Error creating user record for invited user:', userError);
          return jsonResponse(
            { error: userError.message || 'Failed to create user' },
            { status: 500 }
          );
        }

        return jsonResponse({
          success: true,
          user: newUser,
          organization: null,
          pendingInvite: true,
        });
      }

      return jsonResponse({
        success: true,
        user: existingUser,
        organization: null,
        pendingInvite: true,
      });
    }
  }

  const orgName = `${user.email?.split('@')[0] || 'User'}'s Organization`;

  const ensureOrganization = async () => {
    const {
      data: newOrg,
      error: orgError,
    } = await adminClient
      .from('organizations')
      .insert({
        name: orgName,
        subscription_tier: 'growth',
      })
      .select('*')
      .single();

    if (orgError) {
      console.error('Error creating organization (admin):', orgError);
      throw new Error(orgError.message || 'Failed to create organization');
    }

    return newOrg;
  };

  let targetOrg = null;

  // Handle existing user without valid org (including placeholder org_ids)
  const existingUserNeedsOrg = existingUser && (!existingUser.org_id || invalidOrgIds.includes(existingUser.org_id));

  if (existingUserNeedsOrg) {
    targetOrg = await ensureOrganization();

    const {
      data: updatedUser,
      error: updateError,
    } = await adminClient
      .from('users')
      .update({
        org_id: targetOrg.id,
        role: 'owner', // Organization creator is the owner
      })
      .eq('id', existingUser.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating user record:', updateError);
      return jsonResponse(
        { error: updateError.message || 'Failed to update user' },
        { status: 500 }
      );
    }

    // Add to user_organizations table
    await adminClient
      .from('user_organizations')
      .upsert({
        user_id: existingUser.id,
        org_id: targetOrg.id,
        role: 'owner',
        is_active: true,
      }, { onConflict: 'user_id,org_id' });

    return buildResponse(updatedUser);
  }

  if (!existingUser) {
    targetOrg = await ensureOrganization();

    const {
      data: newUser,
      error: userError,
    } = await adminClient
      .from('users')
      .insert({
        id: user.id,
        email: user.email || '',
        full_name: (user.user_metadata as { full_name?: string } | null)?.full_name || null,
        org_id: targetOrg.id,
        role: 'owner', // Organization creator is the owner
      })
      .select('*')
      .single();

    if (userError) {
      console.error('Error creating user record:', userError);
      return jsonResponse(
        { error: userError.message || 'Failed to create user' },
        { status: 500 }
      );
    }

    // Add to user_organizations table
    await adminClient
      .from('user_organizations')
      .upsert({
        user_id: user.id,
        org_id: targetOrg.id,
        role: 'owner',
        is_active: true,
      }, { onConflict: 'user_id,org_id' });

    return buildResponse(newUser);
  }

  const latestUser = (await getUserById()).data;
  return latestUser ? buildResponse(latestUser) : jsonResponse(
    { error: 'Unable to resolve user record' },
    { status: 500 }
  );
}
