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
  const { userWithOrg, loading } = useAuth();
  const organization = userWithOrg?.organization as Organization | null;
  const subscriptionStatus = useSubscriptionAccess(organization);

  // Don't show subscription banner while loading or if no issues
  const showBanner = !loading && subscriptionStatus.message && organization;

  return (
    <>
      {/* Subscription warning banner - shown at top of dashboard */}
      {showBanner && (
        <div className="sticky top-0 z-50 px-4 pt-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SubscriptionBanner status={subscriptionStatus} />
        </div>
      )}
      {children}
      <FloatingAIButton />
    </>
  );
}
