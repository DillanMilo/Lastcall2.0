"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Package,
  Users,
  Sparkles,
  Zap,
  ArrowRight,
  X,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type LimitType = "products" | "users" | "ai_requests" | "integration";

interface UpgradePromptProps {
  type: LimitType;
  currentCount?: number;
  limit?: number;
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

const limitConfig: Record<
  LimitType,
  {
    icon: typeof Package;
    title: string;
    description: string;
    color: string;
    bgColor: string;
    upgradeBenefit: string;
  }
> = {
  products: {
    icon: Package,
    title: "Product Limit Reached",
    description: "You've reached your plan's product limit.",
    color: "text-primary",
    bgColor: "bg-primary/10",
    upgradeBenefit: "Upgrade to add more products to your inventory",
  },
  users: {
    icon: Users,
    title: "Team Member Limit Reached",
    description: "You've reached your plan's user limit.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    upgradeBenefit: "Upgrade to invite more team members",
  },
  ai_requests: {
    icon: Sparkles,
    title: "AI Request Limit Reached",
    description: "You've used all your AI requests this month.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    upgradeBenefit: "Upgrade for more AI-powered insights",
  },
  integration: {
    icon: Zap,
    title: "Feature Not Available",
    description: "This integration requires a higher plan.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    upgradeBenefit: "Upgrade to unlock integrations like BigCommerce",
  },
};

const planBenefits = [
  { tier: "Growth", products: "2,000", users: "5", ai: "2,000/mo" },
  { tier: "Pro", products: "10,000", users: "15", ai: "10,000/mo" },
  { tier: "Enterprise", products: "Unlimited", users: "Unlimited", ai: "Unlimited" },
];

export function UpgradePrompt({
  type,
  currentCount,
  limit,
  isOpen = false,
  onClose,
  inline = false,
}: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const config = limitConfig[type];
  const Icon = config.icon;

  const handleClose = () => {
    setDismissed(true);
    onClose?.();
  };

  if (dismissed && inline) return null;

  const content = (
    <div className={cn("space-y-6", inline && "p-6 rounded-xl border bg-card")}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={cn("p-3 rounded-xl", config.bgColor)}>
          <Icon className={cn("h-6 w-6", config.color)} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{config.title}</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {config.description}
            {currentCount !== undefined && limit !== undefined && (
              <span className="block mt-1 font-medium text-foreground">
                Currently using {currentCount.toLocaleString()} of {limit.toLocaleString()}
              </span>
            )}
          </p>
        </div>
        {inline && (
          <button
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Upgrade Benefits */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <Crown className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Upgrade your plan</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {config.upgradeBenefit}
        </p>

        {/* Plan comparison */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {planBenefits.map((plan) => (
            <div
              key={plan.tier}
              className="bg-background/50 rounded-lg p-2 text-center"
            >
              <p className="font-semibold mb-1">{plan.tier}</p>
              <p className="text-muted-foreground">
                {type === "products" && `${plan.products} products`}
                {type === "users" && `${plan.users} users`}
                {type === "ai_requests" && `${plan.ai} AI`}
                {type === "integration" && "All integrations"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex gap-3">
        <Link href="/dashboard/settings" className="flex-1">
          <Button className="w-full">
            View Plans
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        {!inline && onClose && (
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
        )}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage upgrade prompt state
 */
export function useUpgradePrompt() {
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    type: LimitType;
    currentCount?: number;
    limit?: number;
  }>({
    isOpen: false,
    type: "products",
  });

  const showPrompt = (
    type: LimitType,
    currentCount?: number,
    limit?: number
  ) => {
    setPromptState({ isOpen: true, type, currentCount, limit });
  };

  const closePrompt = () => {
    setPromptState((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    ...promptState,
    showPrompt,
    closePrompt,
  };
}
