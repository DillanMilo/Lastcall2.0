'use client';

import { useMemo } from 'react';
import type { Organization } from '@/types';
import { checkSubscriptionAccess, type SubscriptionAccessStatus } from '@/lib/stripe/subscription-access';

/**
 * Hook to check subscription access status for an organization
 */
export function useSubscriptionAccess(organization: Organization | null): SubscriptionAccessStatus {
  return useMemo(() => checkSubscriptionAccess(organization), [organization]);
}
