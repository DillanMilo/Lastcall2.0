import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { getPlanByTier, type PlanTier } from '@/lib/stripe/config';

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

    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    const plan = getPlanByTier(planId as PlanTier);

    if (!plan || !plan.priceId) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
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

    // Only owners can manage billing
    if (userData.role !== 'owner') {
      return jsonResponse(
        { error: 'Forbidden', message: 'Only organization owners can manage billing' },
        { status: 403 }
      );
    }

    const { data: orgData, error: orgError } = await adminClient
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', userData.org_id)
      .single();

    if (orgError || !orgData) {
      return jsonResponse(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get or create Stripe customer
    let customerId = orgData.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: orgData.name,
        metadata: {
          org_id: orgData.id,
          user_id: user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID to database
      await adminClient
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgData.id);
    }

    // Create checkout session
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Add 14-day free trial for Growth plan
    const trialDays = plan.id === 'growth' ? 14 : undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard/settings?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dashboard/settings?subscription=cancelled`,
      metadata: {
        org_id: orgData.id,
        plan_tier: plan.id,
      },
      subscription_data: {
        metadata: {
          org_id: orgData.id,
          plan_tier: plan.id,
        },
        ...(trialDays && { trial_period_days: trialDays }),
      },
    });

    return jsonResponse({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
