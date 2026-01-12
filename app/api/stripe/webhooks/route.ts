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
        console.log('Payment succeeded for invoice:', invoice.id);
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
  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? getPlanByPriceId(priceId) : null;

  const status = subscription.status;
  const isActive = status === 'active' || status === 'trialing';

  await adminClient
    .from('organizations')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: isActive ? (plan?.id || 'starter') : 'free',
      subscription_status: status,
    })
    .eq('id', orgId);

  console.log(`Subscription updated for org ${orgId}: ${status}, tier: ${plan?.id || 'unknown'}`);
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
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.error('Could not find organization for cancelled subscription');
    return;
  }

  await adminClient
    .from('organizations')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
    })
    .eq('id', org.id);

  console.log(`Subscription cancelled for org ${org.id}`);
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
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) return;

  await adminClient
    .from('organizations')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', org.id);

  console.log(`Payment failed for org ${org.id}`);
}
