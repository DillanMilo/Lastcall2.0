# Stripe Setup Guide for LastCallIQ

Follow this checklist to complete your Stripe integration. Check off each item as you go!

---

## Prerequisites

- [ ] You have a Stripe account (https://dashboard.stripe.com)
- [ ] You have access to your Supabase project

---

## Step 1: Get Your API Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Make sure you're in **Test Mode** (toggle in top-right corner) to start
3. Copy your keys:

- [ ] **Publishable key** (starts with `pk_test_`)
- [ ] **Secret key** (click "Reveal" to see it, starts with `sk_test_`)

> Keep these safe! Never commit your secret key to git.

---

## Step 2: Create Products in Stripe

Go to https://dashboard.stripe.com/products and create 3 products:

### Product 1: Starter ($29/mo)
- [ ] Click **+ Add product**
- [ ] Name: `Starter`
- [ ] Description: `Perfect for small shops - 500 products, 1 user, 500 AI requests/month`
- [ ] Add price: **$29.00 USD**, **Recurring**, **Monthly**
- [ ] Save and copy the **Price ID**: `price_________________`

### Product 2: Growth ($79/mo)
- [ ] Click **+ Add product**
- [ ] Name: `Growth`
- [ ] Description: `For growing businesses - 2,000 products, 3 users, 2,000 AI requests/month`
- [ ] Add price: **$79.00 USD**, **Recurring**, **Monthly**
- [ ] Save and copy the **Price ID**: `price_________________`

### Product 3: Business ($149/mo)
- [ ] Click **+ Add product**
- [ ] Name: `Business`
- [ ] Description: `For larger operations - 10,000 products, 10 users, unlimited AI requests`
- [ ] Add price: **$149.00 USD**, **Recurring**, **Monthly**
- [ ] Save and copy the **Price ID**: `price_________________`

---

## Step 3: Set Up Webhook Endpoint

1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**

- [ ] **Endpoint URL**: `https://lastcallsmart.com/api/stripe/webhooks`

  > Replace with your actual domain when you deploy

- [ ] Click **+ Select events** and add these events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

- [ ] Click **Add endpoint**
- [ ] Click on your new endpoint and copy the **Signing secret** (starts with `whsec_`)

**Signing secret**: `whsec_________________`

---

## Step 4: Configure Customer Portal

1. Go to https://dashboard.stripe.com/settings/billing/portal

- [ ] Enable **Invoice history**
- [ ] Enable **Payment method updates** (allow customers to update their card)
- [ ] Enable **Subscription cancellation** (allow customers to cancel)
- [ ] Enable **Subscription switching** (allow plan upgrades/downgrades)
- [ ] Click **Save**

---

## Step 5: Run Database Migration

1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Paste the following SQL:

```sql
-- Add Stripe columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
ON organizations(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription
ON organizations(stripe_subscription_id);
```

- [ ] Click **Run**
- [ ] Verify it says "Success"

---

## Step 6: Add Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Stripe Price IDs
STRIPE_PRICE_STARTER=price_xxxxx
STRIPE_PRICE_GROWTH=price_xxxxx
STRIPE_PRICE_BUSINESS=price_xxxxx
```

- [ ] Added `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Added `STRIPE_SECRET_KEY`
- [ ] Added `STRIPE_WEBHOOK_SECRET`
- [ ] Added `STRIPE_PRICE_STARTER`
- [ ] Added `STRIPE_PRICE_GROWTH`
- [ ] Added `STRIPE_PRICE_BUSINESS`

---

## Step 7: Add Environment Variables to Vercel (Production)

If deploying to Vercel:

1. Go to your project in Vercel Dashboard
2. Click **Settings** > **Environment Variables**
3. Add each variable from Step 6

- [ ] Added all 6 Stripe environment variables to Vercel

---

## Step 8: Test Your Integration

### Local Testing

- [ ] Start your dev server: `npm run dev`
- [ ] Go to http://localhost:3000/dashboard/settings
- [ ] You should see the Subscription card with pricing plans

### Test a Purchase (with Stripe CLI)

1. Install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe
```

2. Login and forward webhooks:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```

3. Use test card numbers:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - Expiry: Any future date (e.g., 12/34)
   - CVC: Any 3 digits (e.g., 123)

- [ ] Successfully completed a test purchase
- [ ] Webhook received and processed
- [ ] Subscription tier updated in database

---

## Going Live Checklist

When ready to accept real payments:

- [ ] Toggle Stripe Dashboard to **Live Mode** (top-right corner)
- [ ] Get your **live** API keys (pk_live_..., sk_live_...)
- [ ] Create products/prices again in live mode (or copy from test)
- [ ] Create a new webhook endpoint for production
- [ ] Update all environment variables with live keys
- [ ] Test with a real card (you can refund immediately)

---

## Troubleshooting

### "STRIPE_SECRET_KEY is not set"
- Make sure your `.env.local` file is in the project root
- Restart your dev server after adding env vars

### Webhook not receiving events
- Check the webhook endpoint URL is correct
- Verify the signing secret matches
- Check Stripe Dashboard > Webhooks > Recent events for errors

### Subscription not updating in database
- Check Supabase logs for errors
- Verify the SQL migration ran successfully
- Check that `org_id` is being passed in checkout metadata

---

## Quick Reference

| What | Where to Find |
|------|---------------|
| API Keys | https://dashboard.stripe.com/apikeys |
| Products | https://dashboard.stripe.com/products |
| Webhooks | https://dashboard.stripe.com/webhooks |
| Customer Portal | https://dashboard.stripe.com/settings/billing/portal |
| Test Events | https://dashboard.stripe.com/events |
| Stripe CLI Docs | https://stripe.com/docs/stripe-cli |

---

## Test Card Numbers

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |
| 4000 0025 0000 3155 | Requires 3D Secure |
| 4000 0000 0000 9995 | Insufficient funds |

Use any future expiry date and any 3-digit CVC.

---

Happy billing! 🎉
