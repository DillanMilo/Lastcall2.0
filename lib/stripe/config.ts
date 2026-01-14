export type PlanTier = 'free' | 'starter' | 'growth' | 'pro' | 'enterprise';

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
    price: 99,
    priceId: process.env.STRIPE_PRICE_STARTER || '',
    features: [
      'Up to 500 products',
      '2 users',
      'Full inventory tracking',
      'CSV import',
      'Expiry alerts',
      '500 AI requests/month',
      'Email support',
    ],
    limits: {
      products: 500,
      users: 2,
      aiRequests: 500,
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For growing businesses',
    price: 149,
    priceId: process.env.STRIPE_PRICE_GROWTH || '',
    features: [
      'Up to 2,000 products',
      '5 users',
      'Full inventory tracking',
      'CSV import',
      'Expiry alerts',
      'Smart ordering recommendations',
      '2,000 AI requests/month',
      'Priority support',
    ],
    limits: {
      products: 2000,
      users: 5,
      aiRequests: 2000,
    },
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For scaling operations',
    price: 299,
    priceId: process.env.STRIPE_PRICE_PRO || '',
    features: [
      'Up to 10,000 products',
      '15 users',
      'Full inventory tracking',
      'CSV import',
      'Expiry alerts',
      'Smart ordering recommendations',
      'API access',
      '10,000 AI requests/month',
      'Dedicated support',
    ],
    limits: {
      products: 10000,
      users: 15,
      aiRequests: 10000,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 799,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
    features: [
      'Unlimited products',
      'Unlimited users',
      'Full inventory tracking',
      'CSV import',
      'Expiry alerts',
      'Smart ordering recommendations',
      'API access',
      'Unlimited AI requests',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    limits: {
      products: -1, // unlimited
      users: -1, // unlimited
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
