import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { checkUserLimit } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';
import { generateTeamInviteEmail } from '@/lib/email/templates';

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
 * GET /api/team/invites
 * List all pending invites and team members for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const userOrg = await getAuthenticatedUserOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get organization info
    const { data: orgData } = await adminClient
      .from('organizations')
      .select('name, subscription_tier')
      .eq('id', userOrg.orgId)
      .single();

    // Get team members
    const { data: members, error: membersError } = await adminClient
      .from('users')
      .select('id, email, full_name, role, created_at')
      .eq('org_id', userOrg.orgId)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching members:', membersError);
    }

    // Get pending invites
    const { data: invites, error: invitesError } = await adminClient
      .from('team_invites')
      .select('id, email, role, created_at, expires_at')
      .eq('org_id', userOrg.orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (invitesError) {
      console.error('Error fetching invites:', invitesError);
    }

    // Get tier limits
    const tier = (orgData?.subscription_tier || 'free') as PlanTier;
    const limitCheck = await checkUserLimit(adminClient, userOrg.orgId, tier);

    return NextResponse.json({
      success: true,
      organization: {
        name: orgData?.name,
        tier,
      },
      members: members || [],
      invites: invites || [],
      limits: {
        used: limitCheck.currentCount || 0,
        limit: limitCheck.limit || 1,
        unlimited: limitCheck.limit === -1,
      },
      currentUser: {
        id: userOrg.userId,
        role: userOrg.role,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/team/invites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/team/invites
 * Create a new team invite (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const userOrg = await getAuthenticatedUserOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can invite team members
    if (userOrg.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only admins can invite team members' },
        { status: 403 }
      );
    }

    const { email, role = 'member' } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get organization tier
    const { data: orgData, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier, name')
      .eq('id', userOrg.orgId)
      .single();

    if (orgError || !orgData) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const tier = (orgData.subscription_tier || 'free') as PlanTier;

    // Check user limit (including pending invites)
    const { count: memberCount } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', userOrg.orgId);

    const { count: inviteCount } = await adminClient
      .from('team_invites')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', userOrg.orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    const totalUsers = (memberCount || 0) + (inviteCount || 0);
    const limitCheck = await checkUserLimit(adminClient, userOrg.orgId, tier);

    if (!limitCheck.allowed || (limitCheck.limit !== -1 && totalUsers >= limitCheck.limit!)) {
      return NextResponse.json(
        {
          error: 'User limit reached',
          message: `Your ${tier} plan allows ${limitCheck.limit} team members. Upgrade to add more.`,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // Check if user already exists in org
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('org_id', userOrg.orgId)
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'This user is already a team member' },
        { status: 400 }
      );
    }

    // Check if invite already exists
    const { data: existingInvite } = await adminClient
      .from('team_invites')
      .select('id')
      .eq('org_id', userOrg.orgId)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invite has already been sent to this email' },
        { status: 400 }
      );
    }

    // Generate invite token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    // Create invite
    const { data: invite, error: createError } = await adminClient
      .from('team_invites')
      .insert({
        org_id: userOrg.orgId,
        email: normalizedEmail,
        role: role === 'admin' ? 'admin' : 'member',
        invited_by: userOrg.userId,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select('id, email, role, created_at, expires_at')
      .single();

    if (createError) {
      console.error('Error creating invite:', createError);
      return NextResponse.json(
        { error: 'Failed to create invite' },
        { status: 500 }
      );
    }

    // Generate invite URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${siteUrl}/auth/invite?token=${token}`;

    // Get inviter's name for the email
    const { data: inviterData } = await adminClient
      .from('users')
      .select('full_name, email')
      .eq('id', userOrg.userId)
      .single();

    const inviterName = inviterData?.full_name || inviterData?.email?.split('@')[0] || 'A team member';

    // Send invitation email
    const { subject, html } = generateTeamInviteEmail({
      inviteeEmail: normalizedEmail,
      inviterName,
      organizationName: orgData.name || 'Your Team',
      role: role === 'admin' ? 'admin' : 'member',
      inviteUrl,
      expiresInDays: 7,
    });

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject,
      html,
    });

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error);
      console.error('Email details - To:', normalizedEmail, 'Error:', emailResult.error);
    } else {
      console.log('Invite email sent successfully to:', normalizedEmail, 'Message ID:', emailResult.messageId);
    }

    return NextResponse.json({
      success: true,
      invite,
      inviteUrl,
      emailSent: emailResult.success,
      emailError: emailResult.error || null,
      emailMessageId: emailResult.messageId || null,
      message: emailResult.success
        ? `Invitation email sent to ${normalizedEmail}`
        : `Invite created for ${normalizedEmail}. Email delivery failed: ${emailResult.error || 'Unknown error'}. Share the link manually.`,
    });
  } catch (error) {
    console.error('Error in POST /api/team/invites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/team/invites
 * Cancel a pending invite (Admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const userOrg = await getAuthenticatedUserOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can cancel invites
    if (userOrg.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only admins can cancel invites' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('id');

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify invite belongs to user's org
    const { data: invite } = await adminClient
      .from('team_invites')
      .select('id')
      .eq('id', inviteId)
      .eq('org_id', userOrg.orgId)
      .single();

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Delete invite
    const { error: deleteError } = await adminClient
      .from('team_invites')
      .delete()
      .eq('id', inviteId);

    if (deleteError) {
      console.error('Error deleting invite:', deleteError);
      return NextResponse.json({ error: 'Failed to cancel invite' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Invite cancelled',
    });
  } catch (error) {
    console.error('Error in DELETE /api/team/invites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
