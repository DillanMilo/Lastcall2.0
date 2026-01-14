"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  Users,
  Sparkles,
  TrendingUp,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface UsageData {
  used: number;
  limit: number;
  percentage: number;
  unlimited: boolean;
  resetsAt?: string;
}

interface UsageResponse {
  success: boolean;
  organization: {
    id: string;
    name: string;
    tier: string;
  };
  usage: {
    products: UsageData;
    users: UsageData;
    aiRequests: UsageData;
  };
}

interface UsageDashboardProps {
  compact?: boolean;
}

export function UsageDashboard({ compact = false }: UsageDashboardProps) {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch("/api/usage");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch usage");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <p>{error || "Unable to load usage data"}</p>
        </CardContent>
      </Card>
    );
  }

  const { usage, organization } = data;

  const getProgressColor = (percentage: number, unlimited: boolean) => {
    if (unlimited) return "bg-primary";
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 75) return "bg-amber-500";
    return "bg-primary";
  };

  const getStatusIcon = (percentage: number, unlimited: boolean) => {
    if (unlimited) return null;
    if (percentage >= 90) return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (percentage >= 75) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return null;
  };

  const formatLimit = (limit: number, unlimited: boolean) => {
    if (unlimited) return "Unlimited";
    return limit.toLocaleString();
  };

  const usageItems = [
    {
      label: "Products",
      icon: Package,
      data: usage.products,
      description: "Inventory items",
    },
    {
      label: "Team Members",
      icon: Users,
      data: usage.users,
      description: "Users in your organization",
    },
    {
      label: "AI Requests",
      icon: Sparkles,
      data: usage.aiRequests,
      description: usage.aiRequests.resetsAt
        ? `Resets ${new Date(usage.aiRequests.resetsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : "This month",
    },
  ];

  const needsUpgrade = usageItems.some(
    (item) => !item.data.unlimited && item.data.percentage >= 80
  );

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Usage
            </CardTitle>
            <span className="text-xs text-muted-foreground capitalize">
              {organization.tier} Plan
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {usageItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">
                  {item.data.used.toLocaleString()}/{formatLimit(item.data.limit, item.data.unlimited)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    getProgressColor(item.data.percentage, item.data.unlimited)
                  )}
                  style={{ width: item.data.unlimited ? "15%" : `${item.data.percentage}%` }}
                />
              </div>
            </div>
          ))}
          {needsUpgrade && (
            <Link href="/dashboard/settings">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Upgrade Plan
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage & Limits
            </CardTitle>
            <CardDescription>
              Track your usage across your {organization.tier} plan
            </CardDescription>
          </div>
          {needsUpgrade && (
            <Link href="/dashboard/settings">
              <Button size="sm">
                Upgrade
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">
          {usageItems.map((item) => {
            const Icon = item.icon;
            const isNearLimit = !item.data.unlimited && item.data.percentage >= 75;
            const isAtLimit = !item.data.unlimited && item.data.percentage >= 90;

            return (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  isAtLimit && "border-destructive/50 bg-destructive/5",
                  isNearLimit && !isAtLimit && "border-amber-500/50 bg-amber-500/5"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        isAtLimit
                          ? "bg-destructive/10"
                          : isNearLimit
                          ? "bg-amber-500/10"
                          : "bg-primary/10"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isAtLimit
                            ? "text-destructive"
                            : isNearLimit
                            ? "text-amber-500"
                            : "text-primary"
                        )}
                      />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {getStatusIcon(item.data.percentage, item.data.unlimited)}
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {item.data.used.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      / {formatLimit(item.data.limit, item.data.unlimited)}
                    </span>
                  </div>

                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        getProgressColor(item.data.percentage, item.data.unlimited)
                      )}
                      style={{
                        width: item.data.unlimited ? "10%" : `${Math.max(item.data.percentage, 2)}%`,
                      }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">{item.description}</p>

                  {isAtLimit && (
                    <p className="text-xs text-destructive font-medium">
                      Limit reached - upgrade to continue
                    </p>
                  )}
                  {isNearLimit && !isAtLimit && (
                    <p className="text-xs text-amber-600 font-medium">
                      Approaching limit ({item.data.percentage}% used)
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
