"use client";

import { useState } from "react";
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
  // Note: _onSubscriptionChange can be used to refresh data after returning from Stripe
  void _onSubscriptionChange;
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTier = organization?.subscription_tier || "free";
  const subscriptionStatus = organization?.subscription_status;

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

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        // Fallback: construct checkout URL manually
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
          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
          config.className
        )}
      >
        {config.label}
      </span>
    );
  };

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

        {/* Current Plan Info */}
        {organization?.stripe_subscription_id && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-lg font-semibold capitalize">{currentTier}</p>
            </div>
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
                  <ExternalLink className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Pricing Plans Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PRICING_PLANS.map((plan) => {
            const isCurrentPlan = currentTier === plan.id;
            const isDowngrade =
              PRICING_PLANS.findIndex((p) => p.id === currentTier) >
              PRICING_PLANS.findIndex((p) => p.id === plan.id);

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border p-4 transition-all",
                  isCurrentPlan
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-primary/50",
                  plan.popular && !isCurrentPlan && "border-primary/30"
                )}
              >
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      <Sparkles className="h-3 w-3" />
                      Popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">/mo</span>
                  )}
                </div>

                <ul className="mb-6 space-y-2 flex-1">
                  {plan.features.slice(0, 5).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                  {plan.features.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      +{plan.features.length - 5} more features
                    </li>
                  )}
                </ul>

                <Button
                  variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  disabled={
                    isCurrentPlan ||
                    plan.id === "free" ||
                    loading === plan.id ||
                    isDowngrade
                  }
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {loading === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : isDowngrade ? (
                    "Manage in Portal"
                  ) : plan.id === "free" ? (
                    "Free"
                  ) : (
                    "Upgrade"
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          All plans include a 14-day money-back guarantee. Cancel anytime.
        </p>
      </CardContent>
    </Card>
  );
}
