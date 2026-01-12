export type PlanTier = 'free' | 'starter' | 'growth' | 'business';

export interface PricingPlan {
  id: PlanTier;
  name: string;
  description: string;
  price: number;
  priceId: string | null; // Stripe Price ID (null for free tier)
  features: string[];
  limits: {
    products: number;
    users: number;
    aiRequests: number; // per month
  };
  popular?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free Trial',
    description: 'Try LastCallIQ free for 14 days',
    price: 0,
    priceId: null,
    features: [
      'Up to 50 products',
      '1 user',
      'Basic inventory tracking',
      'CSV import',
      '50 AI requests/month',
    ],
    limits: {
      products: 50,
      users: 1,
      aiRequests: 50,
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small shops',
    price: 29,
    priceId: process.env.STRIPE_PRICE_STARTER || '',
    features: [
      'Up to 500 products',
      '1 user',
      'Full inventory tracking',
      'CSV import',
      'Expiry alerts',
      '500 AI requests/month',
      'Email support',
    ],
    limits: {
      products: 500,
      users: 1,
      aiRequests: 500,
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For growing businesses',
    price: 79,
    priceId: process.env.STRIPE_PRICE_GROWTH || '',
    features: [
      'Up to 2,000 products',
      '3 users',
      'Full inventory tracking',
      'CSV import',
      'Expiry alerts',
      'Smart ordering recommendations',
      '2,000 AI requests/month',
      'Priority support',
    ],
    limits: {
      products: 2000,
      users: 3,
      aiRequests: 2000,
    },
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For larger operations',
    price: 149,
    priceId: process.env.STRIPE_PRICE_BUSINESS || '',
    features: [
      'Up to 10,000 products',
      '10 users',
      'Full inventory tracking',
      'CSV import',
      'Expiry alerts',
      'Smart ordering recommendations',
      'API access',
      'Unlimited AI requests',
      'Dedicated support',
    ],
    limits: {
      products: 10000,
      users: 10,
      aiRequests: -1, // unlimited
    },
  },
];

export function getPlanByTier(tier: PlanTier): PricingPlan | undefined {
  return PRICING_PLANS.find((plan) => plan.id === tier);
}

export function getPlanByPriceId(priceId: string): PricingPlan | undefined {
  return PRICING_PLANS.find((plan) => plan.priceId === priceId);
}
