"use client";

import { useState } from "react";
import Link from "next/link";
import { Organization } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRICING_PLANS, type PlanTier } from "@/lib/stripe/config";
import {
  Loader2,
  Check,
  CreditCard,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Crown,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SubscriptionCardProps {
  organization: Organization | null;
  onSubscriptionChange?: () => void;
}

export function SubscriptionCard({
  organization,
  onSubscriptionChange: _onSubscriptionChange,
}: SubscriptionCardProps) {
  void _onSubscriptionChange;
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTier = organization?.subscription_tier || "free";
  const subscriptionStatus = organization?.subscription_status;
  const billingExempt = organization?.billing_exempt === true;
  const currentPlan = PRICING_PLANS.find((p) => p.id === currentTier);
  const currentPlanIndex = PRICING_PLANS.findIndex((p) => p.id === currentTier);

  // Only show plans that are upgrades (higher than current)
  const upgradePlans = PRICING_PLANS.filter(
    (_, index) => index > currentPlanIndex
  );

  // Billing exempt organizations see a simplified view
  if (billingExempt) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Enterprise Account
              </CardTitle>
              <CardDescription>
                Your organization has full access to all features
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Unlimited Access</p>
                <p className="text-sm text-muted-foreground">
                  All features enabled with no usage limits
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSelectPlan = async (planId: PlanTier) => {
    if (planId === "free" || planId === currentTier) return;

    setLoading(planId);
    setError(null);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        window.location.href = `https://checkout.stripe.com/c/pay/${data.sessionId}`;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      console.error("Checkout error:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("portal");
    setError(null);

    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      console.error("Portal error:", err);
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = () => {
    if (!subscriptionStatus || subscriptionStatus === "active") return null;

    const statusConfig = {
      past_due: {
        label: "Payment Failed",
        className: "bg-destructive/10 text-destructive",
      },
      canceled: {
        label: "Cancelled",
        className: "bg-muted text-muted-foreground",
      },
      trialing: {
        label: "Trial",
        className: "bg-primary/10 text-primary",
      },
    };

    const config = statusConfig[subscriptionStatus as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
          config.className
        )}
      >
        {config.label}
      </span>
    );
  };

  const isTopTier = currentTier === "enterprise";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Current Plan Card */}
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <div className="flex items-center gap-2">
                {isTopTier && <Crown className="h-5 w-5 text-primary" />}
                <p className="text-2xl font-bold capitalize">{currentPlan?.name || currentTier}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentPlan?.price === 0
                  ? "Free trial"
                  : `$${currentPlan?.price}/month`}
              </p>
            </div>
            {organization?.stripe_subscription_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageBilling}
                disabled={loading === "portal"}
              >
                {loading === "portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Manage Billing
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Current plan features */}
          {currentPlan && (
            <div className="mt-4 pt-4 border-t border-primary/10">
              <p className="text-xs font-medium text-muted-foreground mb-2">Your plan includes:</p>
              <div className="grid grid-cols-2 gap-2">
                {currentPlan.features.slice(0, 4).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-primary" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upgrade Options */}
        {upgradePlans.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Upgrade your plan</h3>
              <Link
                href="/pricing"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Compare all plans
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {upgradePlans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-md",
                    plan.popular && "border-primary/30"
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                        <Sparkles className="h-2.5 w-2.5" />
                        Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-3">
                    <h4 className="font-semibold text-sm">{plan.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mb-3">
                    <span className="text-2xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>

                  <ul className="mb-4 space-y-1.5 flex-1">
                    {plan.features.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-xs">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 3 && (
                      <li className="text-xs text-muted-foreground pl-5">
                        +{plan.features.length - 3} more
                      </li>
                    )}
                  </ul>

                  <Button
                    variant={plan.popular ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    disabled={loading === plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {loading === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Upgrade"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already on top tier */}
        {isTopTier && (
          <div className="text-center py-4">
            <Crown className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">You&apos;re on the top tier!</p>
            <p className="text-xs text-muted-foreground">
              Enjoy unlimited access to all features.
            </p>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          All plans include a 14-day money-back guarantee. Cancel anytime.
        </p>
      </CardContent>
    </Card>
  );
}
