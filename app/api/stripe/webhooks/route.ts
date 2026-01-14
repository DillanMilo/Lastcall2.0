import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { getPlanByPriceId } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

type AdminClient = SupabaseClient;

export async function POST(request: NextRequest) {
  if (!serviceRoleKey || !webhookSecret) {
    console.error('Missing required environment variables for webhook');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(adminClient, session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(adminClient, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(adminClient, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(adminClient, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(adminClient, invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(
  adminClient: AdminClient,
  session: Stripe.Checkout.Session
) {
  const orgId = session.metadata?.org_id;
  const planTier = session.metadata?.plan_tier;

  if (!orgId) {
    console.error('No org_id in checkout session metadata');
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  await adminClient
    .from('organizations')
    .update({
      stripe_subscription_id: subscriptionId,
      subscription_tier: planTier || 'starter',
    })
    .eq('id', orgId);

  console.log(`Checkout completed for org ${orgId}, plan: ${planTier}`);
}

async function handleSubscriptionChange(
  adminClient: AdminClient,
  subscription: Stripe.Subscription
) {
  const orgId = subscription.metadata?.org_id;

  if (!orgId) {
    // Try to find org by customer ID
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const { data: org } = await adminClient
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!org) {
      console.error('Could not find organization for subscription');
      return;
    }

    await updateOrgSubscription(adminClient, org.id, subscription);
    return;
  }

  await updateOrgSubscription(adminClient, orgId, subscription);
}

async function updateOrgSubscription(
  adminClient: AdminClient,
  orgId: string,
  subscription: Stripe.Subscription
) {
  // Get the price ID from the subscription
  const subscriptionItem = subscription.items.data[0];
  const priceId = subscriptionItem?.price.id;
  const plan = priceId ? getPlanByPriceId(priceId) : null;

  const status = subscription.status;
  const isActive = status === 'active' || status === 'trialing';

  // Track subscription period end date (from the first subscription item)
  const periodEndTimestamp = subscriptionItem?.current_period_end;
  const periodEnd = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000).toISOString()
    : null;

  // Check if subscription was cancelled (cancel_at_period_end = true)
  const isCanceled = subscription.cancel_at_period_end;

  await adminClient
    .from('organizations')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: isActive ? (plan?.id || 'starter') : 'free',
      subscription_status: isCanceled ? 'canceled' : status,
      subscription_period_end: periodEnd,
      canceled_at: isCanceled ? new Date().toISOString() : null,
      // Clear read-only mode if subscription becomes active again
      is_read_only: isActive && !isCanceled ? false : undefined,
    })
    .eq('id', orgId);

  console.log(`Subscription updated for org ${orgId}: ${status}, tier: ${plan?.id || 'unknown'}, canceled: ${isCanceled}`);
}

async function handleSubscriptionDeleted(
  adminClient: AdminClient,
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const { data: org } = await adminClient
    .from('organizations')
    .select('id, subscription_period_end')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.error('Could not find organization for cancelled subscription');
    return;
  }

  // Check if we're still within the billing period (allow access until period end)
  const periodEnd = org.subscription_period_end
    ? new Date(org.subscription_period_end)
    : null;
  const now = new Date();
  const stillHasAccess = periodEnd && periodEnd > now;

  await adminClient
    .from('organizations')
    .update({
      // Keep current tier until period ends, then set to free
      subscription_tier: stillHasAccess ? undefined : 'free',
      subscription_status: 'canceled',
      canceled_at: new Date().toISOString(),
      // Set read-only mode if period has ended
      is_read_only: !stillHasAccess,
    })
    .eq('id', org.id);

  console.log(`Subscription cancelled for org ${org.id}, still has access: ${stillHasAccess}`);
}

async function handlePaymentFailed(
  adminClient: AdminClient,
  invoice: Stripe.Invoice
) {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const { data: org } = await adminClient
    .from('organizations')
    .select('id, payment_failed_at')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) return;

  // Only set payment_failed_at if not already set (first failure starts grace period)
  const paymentFailedAt = org.payment_failed_at || new Date().toISOString();

  await adminClient
    .from('organizations')
    .update({
      subscription_status: 'past_due',
      payment_failed_at: paymentFailedAt,
    })
    .eq('id', org.id);

  console.log(`Payment failed for org ${org.id}, grace period started: ${paymentFailedAt}`);
}

async function handlePaymentSucceeded(
  adminClient: AdminClient,
  invoice: Stripe.Invoice
) {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const { data: org } = await adminClient
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) return;

  // Clear payment failure tracking and restore access
  await adminClient
    .from('organizations')
    .update({
      payment_failed_at: null,
      is_read_only: false,
    })
    .eq('id', org.id);

  console.log(`Payment succeeded for org ${org.id}, grace period cleared`);
}
