import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * GET /api/team/invites/pending?email=xxx
 * Check if there's a pending invite for a given email
 * Returns the invite token if found
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find pending invite for this email
    const { data: invite, error } = await adminClient
      .from('team_invites')
      .select('token')
      .eq('email', email.toLowerCase())
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error checking pending invite:', error);
      return NextResponse.json({ error: 'Failed to check invite' }, { status: 500 });
    }

    if (!invite) {
      return NextResponse.json({ token: null });
    }

    return NextResponse.json({ token: invite.token });
  } catch (error) {
    console.error('Error in GET /api/team/invites/pending:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
