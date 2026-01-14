"use client";

import { FloatingAIButton } from "@/components/ui/FloatingAIButton";
import { SubscriptionBanner } from "@/components/billing/SubscriptionBanner";
import { useAuth } from "@/lib/auth/AuthContext";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import type { Organization } from "@/types";

interface DashboardWrapperProps {
  children: React.ReactNode;
}

export function DashboardWrapper({ children }: DashboardWrapperProps) {
  const { userWithOrg } = useAuth();
  const organization = userWithOrg?.organization as Organization | null;
  const subscriptionStatus = useSubscriptionAccess(organization);

  return (
    <>
      {/* Subscription warning banner - shown at top of dashboard */}
      {subscriptionStatus.message && (
        <div className="sticky top-0 z-50 px-4 pt-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SubscriptionBanner status={subscriptionStatus} />
        </div>
      )}
      {children}
      <FloatingAIButton />
    </>
  );
}
