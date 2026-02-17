import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get authenticated user
    const { supabase, jsonResponse } = createRouteHandlerClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization and role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return jsonResponse(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Only owners can access billing portal
    if (userData.role !== 'owner') {
      return jsonResponse(
        { error: 'Forbidden', message: 'Only organization owners can manage billing' },
        { status: 403 }
      );
    }

    const { data: orgData, error: orgError } = await adminClient
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', userData.org_id)
      .single();

    if (orgError || !orgData?.stripe_customer_id) {
      return jsonResponse(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Create customer portal session
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: orgData.stripe_customer_id,
      return_url: `${siteUrl}/dashboard/settings`,
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error('Stripe portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
