import type { Organization } from '@/types';

const GRACE_PERIOD_DAYS = 7;

export interface SubscriptionAccessStatus {
  hasAccess: boolean;
  isReadOnly: boolean;
  reason?: 'active' | 'trialing' | 'grace_period' | 'canceled_active' | 'expired' | 'payment_failed';
  daysRemaining?: number;
  message?: string;
}

/**
 * Check if an organization has subscription access and whether they're in read-only mode.
 * This handles:
 * - Billing exempt organizations (lifetime/invoice customers)
 * - 7-day grace period for failed payments
 * - Access until end of billing period for cancellations
 * - Read-only mode after grace/period expires
 */
export function checkSubscriptionAccess(org: Organization | null): SubscriptionAccessStatus {
  if (!org) {
    // No message - org is likely still loading
    return {
      hasAccess: false,
      isReadOnly: false,
      reason: 'expired',
    };
  }

  // Billing exempt organizations always have full access (lifetime/invoice customers)
  if (org.billing_exempt) {
    return {
      hasAccess: true,
      isReadOnly: false,
      reason: 'active',
    };
  }

  const now = new Date();

  // Free tier always has access (limited features)
  if (org.subscription_tier === 'free' || org.subscription_tier === 'trial') {
    return {
      hasAccess: true,
      isReadOnly: false,
      reason: 'active',
    };
  }

  // Active subscription
  if (org.subscription_status === 'active') {
    return {
      hasAccess: true,
      isReadOnly: false,
      reason: 'active',
    };
  }

  // Trialing subscription
  if (org.subscription_status === 'trialing') {
    return {
      hasAccess: true,
      isReadOnly: false,
      reason: 'trialing',
    };
  }

  // Payment failed - check grace period
  if (org.subscription_status === 'past_due' && org.payment_failed_at) {
    const failedDate = new Date(org.payment_failed_at);
    const gracePeriodEnd = new Date(failedDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

    const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (now < gracePeriodEnd) {
      return {
        hasAccess: true,
        isReadOnly: false,
        reason: 'grace_period',
        daysRemaining: Math.max(0, daysRemaining),
        message: `Payment failed. Please update your payment method within ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to avoid service interruption.`,
      };
    } else {
      // Grace period expired
      return {
        hasAccess: true,
        isReadOnly: true,
        reason: 'payment_failed',
        daysRemaining: 0,
        message: 'Your payment has failed and the grace period has expired. Please update your payment method to restore full access.',
      };
    }
  }

  // Cancelled subscription - check if still within billing period
  if (org.subscription_status === 'canceled') {
    if (org.subscription_period_end) {
      const periodEnd = new Date(org.subscription_period_end);
      const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (now < periodEnd) {
        return {
          hasAccess: true,
          isReadOnly: false,
          reason: 'canceled_active',
          daysRemaining: Math.max(0, daysRemaining),
          message: `Your subscription has been cancelled. You have full access until ${periodEnd.toLocaleDateString()}.`,
        };
      }
    }

    // Period has ended or no period end date
    return {
      hasAccess: true,
      isReadOnly: true,
      reason: 'expired',
      message: 'Your subscription has ended. Upgrade to restore full access.',
    };
  }

  // If is_read_only is explicitly set
  if (org.is_read_only) {
    return {
      hasAccess: true,
      isReadOnly: true,
      reason: 'expired',
      message: 'Your account is in read-only mode. Please update your subscription to restore full access.',
    };
  }

  // Default: has access
  return {
    hasAccess: true,
    isReadOnly: false,
    reason: 'active',
  };
}

/**
 * Check if an operation should be blocked due to read-only mode
 */
export function isOperationBlocked(org: Organization | null): boolean {
  const status = checkSubscriptionAccess(org);
  return status.isReadOnly;
}
