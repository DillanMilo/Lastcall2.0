'use client';

import { AlertTriangle, Clock, CreditCard, X } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { SubscriptionAccessStatus } from '@/lib/stripe/subscription-access';
import { cn } from '@/lib/utils/cn';

interface SubscriptionBannerProps {
  status: SubscriptionAccessStatus;
  className?: string;
}

export function SubscriptionBanner({ status, className }: SubscriptionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Don't show banner for active subscriptions or if dismissed
  if (dismissed || status.reason === 'active' || status.reason === 'trialing') {
    return null;
  }

  // Don't show if no message
  if (!status.message) {
    return null;
  }

  const getBannerConfig = () => {
    switch (status.reason) {
      case 'grace_period':
        return {
          icon: Clock,
          bgClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800',
          iconClass: 'text-amber-600 dark:text-amber-400',
          textClass: 'text-amber-800 dark:text-amber-200',
          showDismiss: true,
          showAction: true,
          actionText: 'Update Payment',
        };
      case 'canceled_active':
        return {
          icon: Clock,
          bgClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800',
          iconClass: 'text-blue-600 dark:text-blue-400',
          textClass: 'text-blue-800 dark:text-blue-200',
          showDismiss: true,
          showAction: true,
          actionText: 'Resubscribe',
        };
      case 'payment_failed':
      case 'expired':
        return {
          icon: AlertTriangle,
          bgClass: 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800',
          iconClass: 'text-red-600 dark:text-red-400',
          textClass: 'text-red-800 dark:text-red-200',
          showDismiss: false,
          showAction: true,
          actionText: status.reason === 'payment_failed' ? 'Update Payment' : 'View Plans',
        };
      default:
        return null;
    }
  };

  const config = getBannerConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border rounded-lg',
        config.bgClass,
        className
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', config.iconClass)} />
      <p className={cn('flex-1 text-sm', config.textClass)}>
        {status.message}
        {status.isReadOnly && (
          <span className="font-medium ml-1">(Read-only mode)</span>
        )}
      </p>
      <div className="flex items-center gap-2">
        {config.showAction && (
          <Link href="/dashboard/settings">
            <Button size="sm" variant="outline" className="h-8">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              {config.actionText}
            </Button>
          </Link>
        )}
        {config.showDismiss && (
          <button
            onClick={() => setDismissed(true)}
            className={cn(
              'p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors',
              config.textClass
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
