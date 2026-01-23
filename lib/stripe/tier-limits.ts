import { SupabaseClient } from '@supabase/supabase-js';
import { PRICING_PLANS, type PlanTier } from './config';

export interface TierLimitResult {
  allowed: boolean;
  currentCount?: number;
  limit?: number;
  message?: string;
}

/**
 * Unlimited limits for billing-exempt organizations
 */
const UNLIMITED_LIMITS = { products: -1, users: -1, aiRequests: -1 };

/**
 * Get the limits for a specific tier
 * @param tier - The subscription tier
 * @param billingExempt - If true, returns unlimited limits (for lifetime/invoice customers)
 */
export function getTierLimits(tier: PlanTier, billingExempt?: boolean) {
  // Billing exempt organizations get unlimited everything
  if (billingExempt) {
    return UNLIMITED_LIMITS;
  }
  const plan = PRICING_PLANS.find((p) => p.id === tier);
  return plan?.limits || { products: 50, users: 1, aiRequests: 50 };
}

/**
 * Check if organization can add more inventory items
 */
export async function checkInventoryLimit(
  supabase: SupabaseClient,
  orgId: string,
  tier: PlanTier,
  billingExempt?: boolean
): Promise<TierLimitResult> {
  const limits = getTierLimits(tier, billingExempt);

  // Unlimited (-1) means no limit
  if (limits.products === -1) {
    return { allowed: true };
  }

  const { count, error } = await supabase
    .from('inventory_items')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) {
    console.error('Error checking inventory count:', error);
    return { allowed: false, message: 'Failed to check inventory limit' };
  }

  const currentCount = count || 0;
  const allowed = currentCount < limits.products;

  return {
    allowed,
    currentCount,
    limit: limits.products,
    message: allowed
      ? undefined
      : `You've reached the ${limits.products} product limit for the ${tier} plan. Upgrade to add more products.`,
  };
}

/**
 * Check if organization can add more users
 */
export async function checkUserLimit(
  supabase: SupabaseClient,
  orgId: string,
  tier: PlanTier,
  billingExempt?: boolean
): Promise<TierLimitResult> {
  const limits = getTierLimits(tier, billingExempt);

  // Unlimited (-1) means no limit
  if (limits.users === -1) {
    return { allowed: true };
  }

  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) {
    console.error('Error checking user count:', error);
    return { allowed: false, message: 'Failed to check user limit' };
  }

  const currentCount = count || 0;
  const allowed = currentCount < limits.users;

  return {
    allowed,
    currentCount,
    limit: limits.users,
    message: allowed
      ? undefined
      : `You've reached the ${limits.users} user limit for the ${tier} plan. Upgrade to add more team members.`,
  };
}

/**
 * Check if organization can make AI requests this month
 */
export async function checkAIRequestLimit(
  supabase: SupabaseClient,
  orgId: string,
  tier: PlanTier,
  billingExempt?: boolean
): Promise<TierLimitResult> {
  const limits = getTierLimits(tier, billingExempt);

  // Unlimited (-1) means no limit
  if (limits.aiRequests === -1) {
    return { allowed: true };
  }

  // Get start of current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await supabase
    .from('ai_requests')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', startOfMonth);

  if (error) {
    // If table doesn't exist yet, allow the request
    if (error.code === '42P01') {
      return { allowed: true };
    }
    console.error('Error checking AI request count:', error);
    return { allowed: false, message: 'Failed to check AI request limit' };
  }

  const currentCount = count || 0;
  const allowed = currentCount < limits.aiRequests;

  return {
    allowed,
    currentCount,
    limit: limits.aiRequests,
    message: allowed
      ? undefined
      : `You've used all ${limits.aiRequests} AI requests for this month. Upgrade for more AI capabilities.`,
  };
}

/**
 * Log an AI request for tracking
 */
export async function logAIRequest(
  supabase: SupabaseClient,
  orgId: string,
  requestType: 'assistant' | 'label' | 'action'
): Promise<void> {
  try {
    await supabase.from('ai_requests').insert({
      org_id: orgId,
      request_type: requestType,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Error logging AI request:', error);
  }
}

/**
 * Check if a feature is available for a tier
 */
export function checkFeatureAccess(
  tier: PlanTier,
  feature: 'ai_assistant' | 'integrations' | 'api_access' | 'smart_ordering' | 'voice_input',
  billingExempt?: boolean
): TierLimitResult {
  // Billing exempt organizations have access to all features
  if (billingExempt) {
    return { allowed: true };
  }
  const tierIndex = PRICING_PLANS.findIndex((p) => p.id === tier);

  const featureRequirements: Record<string, number> = {
    ai_assistant: 0,      // All tiers (but with limits)
    voice_input: 1,       // Starter+ (index 1)
    integrations: 2,      // Growth+ (index 2)
    api_access: 3,        // Pro+ (index 3)
    smart_ordering: 2,    // Growth+ (index 2)
  };

  const requiredTierIndex = featureRequirements[feature] ?? 0;
  const allowed = tierIndex >= requiredTierIndex;

  const tierNames = ['Free', 'Starter', 'Growth', 'Pro', 'Enterprise'];
  const requiredTier = tierNames[requiredTierIndex];

  return {
    allowed,
    message: allowed
      ? undefined
      : `This feature requires the ${requiredTier} plan or higher. Please upgrade to access this feature.`,
  };
}

/**
 * Check if organization can use ecommerce integrations
 */
export function checkIntegrationAccess(
  tier: PlanTier,
  integration: 'csv' | 'bigcommerce' | 'shopify' | 'clover' | 'api',
  billingExempt?: boolean
): TierLimitResult {
  // Billing exempt organizations have access to all integrations
  if (billingExempt) {
    return { allowed: true };
  }

  // CSV is available for all tiers
  if (integration === 'csv') {
    return { allowed: true };
  }

  // BigCommerce requires Growth+
  if (integration === 'bigcommerce') {
    return checkFeatureAccess(tier, 'integrations', billingExempt);
  }

  // Shopify requires Growth+
  if (integration === 'shopify') {
    return checkFeatureAccess(tier, 'integrations', billingExempt);
  }

  // Clover requires Growth+
  if (integration === 'clover') {
    return checkFeatureAccess(tier, 'integrations', billingExempt);
  }

  // API access requires Pro+
  if (integration === 'api') {
    return checkFeatureAccess(tier, 'api_access', billingExempt);
  }

  return { allowed: false, message: 'Unknown integration type' };
}
