import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { generateWelcomeEmail } from '@/lib/email/templates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * GET /api/team/invites/accept?token=xxx
 * Validate an invite token (before accepting)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find invite by token
    const { data: invite, error: inviteError } = await adminClient
      .from('team_invites')
      .select(`
        id,
        email,
        role,
        expires_at,
        accepted_at,
        org_id,
        organizations (
          name
        )
      `)
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invite' },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: 'This invite has already been used' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invite has expired' },
        { status: 400 }
      );
    }

    // Handle organizations data - can be array or single object depending on query
    const orgData = invite.organizations;
    const organizationName = Array.isArray(orgData)
      ? orgData[0]?.name
      : (orgData as { name: string } | null)?.name || 'Unknown';

    return NextResponse.json({
      success: true,
      invite: {
        email: invite.email,
        role: invite.role,
        organizationName,
      },
    });
  } catch (error) {
    console.error('Error validating invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/team/invites/accept
 * Accept an invite (user must be authenticated)
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.next();

    // Get authenticated user
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
      return NextResponse.json(
        { error: 'You must be signed in to accept an invite' },
        { status: 401 }
      );
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find invite by token
    const { data: invite, error: inviteError } = await adminClient
      .from('team_invites')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invite' },
        { status: 404 }
      );
    }

    // Validate invite
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: 'This invite has already been used' },
        { status: 400 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invite has expired' },
        { status: 400 }
      );
    }

    // Check email matches (case-insensitive)
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: 'Email mismatch',
          message: `This invite was sent to ${invite.email}. Please sign in with that email address.`,
        },
        { status: 403 }
      );
    }

    // Check if user already belongs to an org
    const { data: existingUser } = await adminClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (existingUser?.org_id && existingUser.org_id !== invite.org_id) {
      return NextResponse.json(
        {
          error: 'Already in another organization',
          message: 'You are already a member of another organization. Please contact support to switch organizations.',
        },
        { status: 400 }
      );
    }

    // Update or create user record
    const { error: userError } = await adminClient
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        org_id: invite.org_id,
        role: invite.role,
      }, { onConflict: 'id' });

    if (userError) {
      console.error('Error updating user:', userError);
      return NextResponse.json(
        { error: 'Failed to join organization' },
        { status: 500 }
      );
    }

    // Mark invite as accepted
    await adminClient
      .from('team_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    // Get organization name
    const { data: orgData } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', invite.org_id)
      .single();

    const organizationName = orgData?.name || 'the team';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Send welcome email
    const { subject, html } = generateWelcomeEmail({
      userName: user.user_metadata?.full_name,
      userEmail: user.email!,
      organizationName,
      role: invite.role as 'admin' | 'member',
      dashboardUrl: `${siteUrl}/dashboard`,
    });

    const emailResult = await sendEmail({
      to: user.email!,
      subject,
      html,
    });

    if (!emailResult.success) {
      console.warn('Failed to send welcome email:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: `Welcome to ${organizationName}!`,
      organizationId: invite.org_id,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
