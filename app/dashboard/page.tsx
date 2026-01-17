"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { InventoryItem } from "@/types";
import { useAuth } from "@/lib/auth/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { daysUntilExpiration } from "@/lib/utils";
import Link from "next/link";
import { UsageDashboard } from "@/components/billing/UsageDashboard";

export default function DashboardPage() {
  const router = useRouter();
  const { user, orgId, loading: authLoading, signOut } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stuckState, setStuckState] = useState(false);

  const isSupabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("placeholder") &&
    String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) !== "placeholder-key";

  useEffect(() => {
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session from callback:', error);
            router.push('/auth/signin?error=session_failed');
            return;
          }

          if (data.session) {
            window.history.replaceState(null, '', window.location.pathname);
            window.location.reload();
          }
        } catch (err) {
          console.error('Error handling auth callback:', err);
          router.push('/auth/signin?error=callback_failed');
        }
      }
    };

    handleAuthCallback();
  }, [router]);

  const fetchInventory = useCallback(async () => {
    if (!orgId) return;

    try {
      if (!isSupabaseConfigured) {
        console.warn(
          "Supabase credentials are not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to enable live data."
        );
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("org_id", orgId);

      if (error) {
        console.error("Error fetching inventory:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setItems([]);
      } else {
        setItems(data || []);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected error fetching inventory";
      console.error("Unexpected error fetching inventory:", message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, isSupabaseConfigured]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/auth/signin');
      return;
    }

    if (orgId) {
      setStuckState(false);
      const aiChatKey = `ai-chat-${orgId}`;
      localStorage.removeItem(aiChatKey);

      fetchInventory();
      return;
    }

    // If we have a user but no orgId, check for pending invite
    const pendingInviteToken = localStorage.getItem("pendingInviteToken");
    if (pendingInviteToken) {
      // User has a pending invite, redirect them to accept it
      window.location.href = `/auth/invite?token=${pendingInviteToken}`;
      return;
    }

    // Set a timeout - if no orgId after 5 seconds, show stuck state
    const timeout = setTimeout(() => {
      if (!orgId && user) {
        console.warn('User authenticated but no orgId found after timeout.');
        setStuckState(true);
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [authLoading, user, orgId, router, fetchInventory]);

  const totalItems = items.length;
  const lowStockItems = items.filter(
    (item) => item.quantity <= item.reorder_threshold
  );
  const expiringSoonItems = items.filter((item) => {
    if (!item.expiration_date) return false;
    const days = daysUntilExpiration(item.expiration_date);
    return days > 0 && days <= 7;
  });
  const restockNeeded = lowStockItems.length;

  const stats = [
    {
      title: "Total Items",
      value: authLoading || loading ? "..." : totalItems.toString(),
      description: "Items in inventory",
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Low Stock",
      value: authLoading || loading ? "..." : lowStockItems.length.toString(),
      description: "Below reorder point",
      icon: AlertCircle,
      color: "text-[hsl(var(--warning))]",
      bgColor: "bg-[hsl(var(--warning))]/10",
    },
    {
      title: "Expiring Soon",
      value: authLoading || loading ? "..." : expiringSoonItems.length.toString(),
      description: "Within 7 days",
      icon: Clock,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Restock Needed",
      value: authLoading || loading ? "..." : restockNeeded.toString(),
      description: "Action required",
      icon: TrendingUp,
      color: "text-[hsl(var(--success))]",
      bgColor: "bg-[hsl(var(--success))]/10",
    },
  ];

  const isLoading = authLoading || loading;

  const handleForceSignOut = async () => {
    try {
      localStorage.clear(); // Clear any stuck tokens
      await signOut();
      window.location.href = '/auth/signin';
    } catch {
      // Force redirect even if sign out fails
      window.location.href = '/auth/signin';
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  // Show stuck state recovery UI
  if (stuckState) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle>Account Setup Incomplete</CardTitle>
            <CardDescription>
              Your account isn&apos;t fully set up yet. This can happen if you haven&apos;t accepted a team invite or if there was an issue during sign up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">What you can try:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check your email for a team invite and accept it</li>
                <li>Refresh the page to retry loading</li>
                <li>Sign out and sign back in</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleRefresh} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleForceSignOut} className="flex-1">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Your inventory at a glance
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              variant="elevated"
              className="animate-fade-up opacity-0 overflow-hidden group"
              style={{ animationDelay: `${(index + 1) * 100}ms`, animationFillMode: 'forwards' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold data-value tracking-tight">
                    {stat.value}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {stat.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Items */}
        <Card
          variant="default"
          className="animate-fade-up opacity-0"
          style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Items</CardTitle>
                <CardDescription>Latest inventory additions</CardDescription>
              </div>
              <Link
                href="/dashboard/inventory"
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 animate-shimmer rounded-lg h-16" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">No items yet</p>
                <Link href="/dashboard/import" className="text-sm text-primary hover:underline">
                  Import your inventory
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {items.slice(0, 5).map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors animate-fade-up opacity-0 gap-1 sm:gap-0"
                    style={{ animationDelay: `${600 + index * 50}ms`, animationFillMode: 'forwards' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm line-clamp-2 sm:truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.invoice
                          ? `${item.invoice}`
                          : item.sku || "No SKU"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:block sm:text-right sm:ml-4">
                      <span className="text-xs text-muted-foreground sm:hidden">Qty:</span>
                      <p className="font-semibold data-value">{item.quantity}</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card
          variant="default"
          className="animate-fade-up opacity-0"
          style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Low Stock Alerts</CardTitle>
                <CardDescription>Items needing attention</CardDescription>
              </div>
              {lowStockItems.length > 0 && (
                <Badge variant="warning" dot>
                  {lowStockItems.length} items
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 animate-shimmer rounded-lg h-16" />
                ))}
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-[hsl(var(--success))]" />
                </div>
                <p className="text-sm font-medium text-[hsl(var(--success))]">All stocked up!</p>
                <p className="text-xs text-muted-foreground mt-1">No items below reorder point</p>
              </div>
            ) : (
              <div className="space-y-1">
                {lowStockItems.slice(0, 5).map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors animate-fade-up opacity-0 gap-1 sm:gap-0"
                    style={{ animationDelay: `${700 + index * 50}ms`, animationFillMode: 'forwards' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm line-clamp-2 sm:truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Reorder at: {item.reorder_threshold}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:block sm:text-right sm:ml-4">
                      <Badge variant="warning" size="sm">Low</Badge>
                      <p className="font-semibold text-[hsl(var(--warning))] data-value">
                        {item.quantity} <span className="text-xs font-normal text-muted-foreground">units</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card
          variant="default"
          className="animate-fade-up opacity-0"
          style={{ animationDelay: '700ms', animationFillMode: 'forwards' }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Expiring Soon</CardTitle>
                <CardDescription>Products expiring within 7 days</CardDescription>
              </div>
              {expiringSoonItems.length > 0 && (
                <Badge variant="destructive" dot>
                  {expiringSoonItems.length} items
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 animate-shimmer rounded-lg h-16" />
                ))}
              </div>
            ) : expiringSoonItems.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-[hsl(var(--success))]" />
                </div>
                <p className="text-sm font-medium text-[hsl(var(--success))]">All fresh!</p>
                <p className="text-xs text-muted-foreground mt-1">No items expiring soon</p>
              </div>
            ) : (
              <div className="space-y-1">
                {expiringSoonItems.slice(0, 5).map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors animate-fade-up opacity-0 gap-1 sm:gap-0"
                    style={{ animationDelay: `${800 + index * 50}ms`, animationFillMode: 'forwards' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm line-clamp-2 sm:truncate">{item.name}</p>
                      <p className="text-xs text-destructive">
                        Expires in {daysUntilExpiration(item.expiration_date!)} days
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:block sm:text-right sm:ml-4">
                      <span className="text-xs text-muted-foreground sm:hidden">Qty:</span>
                      <p className="font-semibold data-value">{item.quantity}</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Usage - Compact */}
        <div
          className="animate-fade-up opacity-0"
          style={{ animationDelay: '800ms', animationFillMode: 'forwards' }}
        >
          <UsageDashboard compact />
        </div>
      </div>
    </div>
  );
}
