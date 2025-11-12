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

  let response = NextResponse.next({
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

  const buildResponse = async (userRecord: any) => {
    let organization = null;
    if (userRecord?.org_id) {
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
    });
  };

  const getUserById = async () => {
    return adminClient
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
  };

  let {
    data: existingUser,
    error: existingError,
  } = await getUserById();

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
        full_name: (user.user_metadata as any)?.full_name || null,
        org_id: targetOrg.id,
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

    return buildResponse(newUser);
  }

  const latestUser = (await getUserById()).data;
  return latestUser ? buildResponse(latestUser) : NextResponse.json(
    { error: 'Unable to resolve user record' },
    { status: 500 }
  );
}
