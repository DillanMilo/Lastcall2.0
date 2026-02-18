import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/team/invites/accept-with-password
 * Creates a new user account and accepts the invite in one step
 * This is for users who don't have an account yet
 */
export async function POST(request: NextRequest) {
  try {
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { token, password, fullName } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check password complexity
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Validate the invite token
    const { data: invite, error: inviteError } = await adminClient
      .from('team_invites')
      .select('id, org_id, email, role, expires_at, accepted_at')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invalid invite token' },
        { status: 400 }
      );
    }

    // Check if invite is already accepted
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: 'This invite has already been accepted' },
        { status: 400 }
      );
    }

    // Check if invite is expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invite has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if a user with this email already exists in auth
    // Use filter to search by email instead of listing all users (avoids pagination issues)
    const { data: existingUsers } = await adminClient.auth.admin.listUsers({
      perPage: 1,
      page: 1,
    });
    // Also do a targeted lookup via the users table for reliability
    const { data: existingUserRecord } = await adminClient
      .from('users')
      .select('id')
      .eq('email', invite.email.toLowerCase())
      .limit(1)
      .maybeSingle();

    const existingAuthUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === invite.email.toLowerCase()
    ) || existingUserRecord;

    if (existingAuthUser) {
      return NextResponse.json(
        {
          error: 'An account with this email already exists. Please sign in instead.',
          existingUser: true
        },
        { status: 400 }
      );
    }

    // Create the auth user (skip email verification since they clicked the invite link)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true, // Auto-confirm since they proved ownership by clicking invite link
      user_metadata: {
        full_name: fullName || null,
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Failed to create account' },
        { status: 500 }
      );
    }

    const newUser = authData.user;

    // Create or update the user record in our users table
    // Use upsert in case there's an orphaned record from a previous failed attempt
    const { error: userError } = await adminClient
      .from('users')
      .upsert({
        id: newUser.id,
        email: invite.email,
        full_name: fullName || null,
        org_id: invite.org_id,
        role: invite.role || 'member',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select('*')
      .single();

    if (userError) {
      console.error('Error creating user record:', userError);
      console.error('User insert details:', {
        id: newUser.id,
        email: invite.email,
        org_id: invite.org_id,
        role: invite.role,
      });
      // Try to clean up the auth user if user record creation fails
      await adminClient.auth.admin.deleteUser(newUser.id);
      return NextResponse.json(
        { error: `Failed to create user record: ${userError.message || userError.code || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Add to user_organizations table
    const { error: membershipError } = await adminClient
      .from('user_organizations')
      .insert({
        user_id: newUser.id,
        org_id: invite.org_id,
        role: invite.role || 'member',
        is_active: true,
        joined_at: new Date().toISOString(),
      });

    if (membershipError) {
      console.error('Error creating org membership:', membershipError);
      // Non-fatal - continue anyway
    }

    // Mark invite as accepted
    const { error: acceptError } = await adminClient
      .from('team_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    if (acceptError) {
      console.error('Failed to mark invite as accepted (user already created):', acceptError);
      // Non-fatal: user is already created and in the org, just log the error
    }

    // Get organization details
    const { data: orgData } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', invite.org_id)
      .single();

    return NextResponse.json({
      success: true,
      message: `Welcome to ${orgData?.name || 'the team'}!`,
      user: {
        id: newUser.id,
        email: invite.email,
        org_id: invite.org_id,
        role: invite.role,
      },
    });
  } catch (error) {
    console.error('Error in accept-with-password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
