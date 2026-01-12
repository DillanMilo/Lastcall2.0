import Stripe from 'stripe';

// Create Stripe instance lazily to avoid build-time errors
let stripeInstance: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// For backward compatibility, export as stripe (lazy initialization)
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripeServer()[prop as keyof Stripe];
  },
});
