import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    return NextResponse.json({
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
    return NextResponse.json(
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
      return NextResponse.json(
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
          return NextResponse.json(
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

  if (existingUser && existingUser.org_id) {
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
      // User has a pending invite - create user record without org
      // They'll be assigned to the org when they accept the invite
      if (!existingUser) {
        const { data: newUser, error: userError } = await adminClient
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: (user.user_metadata as { full_name?: string } | null)?.full_name || null,
            org_id: null, // No org yet - will be set when invite is accepted
            role: 'member',
          })
          .select('*')
          .single();

        if (userError) {
          console.error('Error creating user record for invited user:', userError);
          return NextResponse.json(
            { error: userError.message || 'Failed to create user' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          user: newUser,
          organization: null,
          pendingInvite: true, // Signal to frontend that user has pending invite
        });
      }

      // Existing user without org, has pending invite
      return NextResponse.json({
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

  if (existingUser && !existingUser.org_id) {
    targetOrg = await ensureOrganization();

    const {
      data: updatedUser,
      error: updateError,
    } = await adminClient
      .from('users')
      .update({
        org_id: targetOrg.id,
        role: 'admin', // Organization creator is always admin
      })
      .eq('id', existingUser.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating user record (admin):', updateError);
      return NextResponse.json(
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
        role: 'admin',
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
        role: 'admin', // Organization creator is always admin
      })
      .select('*')
      .single();

    if (userError) {
      console.error('Error creating user record (admin):', userError);
      return NextResponse.json(
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
        role: 'admin',
        is_active: true,
      }, { onConflict: 'user_id,org_id' });

    return buildResponse(newUser);
  }

  const latestUser = (await getUserById()).data;
  return latestUser ? buildResponse(latestUser) : NextResponse.json(
    { error: 'Unable to resolve user record' },
    { status: 500 }
  );
}
