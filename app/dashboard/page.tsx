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
import { Button } from "@/components/ui/button";
import {
  Package,
  AlertCircle,
  TrendingUp,
  Clock,
  Sparkles,
} from "lucide-react";
import { daysUntilExpiration } from "@/lib/utils";
import { AIAssistant } from "@/components/inventory/AIAssistant";

export default function DashboardPage() {
  const router = useRouter();
  const { user, orgId, loading: authLoading } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const isSupabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("placeholder") &&
    String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) !== "placeholder-key";

  // Handle email confirmation callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check if this is an email confirmation callback (has hash fragments)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        try {
          // Exchange the tokens for a session
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session from callback:', error);
            // Redirect to signin if session setup fails
            router.push('/auth/signin?error=session_failed');
            return;
          }

          if (data.session) {
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname);
            // Force a page reload to refresh auth state
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
      const aiChatKey = `ai-chat-${orgId}`;
      localStorage.removeItem(aiChatKey);

      fetchInventory();
      return;
    }

    const timeout = setTimeout(() => {
      if (!orgId && user) {
        console.warn('User authenticated but no orgId found. User record may need to be created.');
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [authLoading, user, orgId, router, fetchInventory]);

  // Calculate stats from real data
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
  const restockItems = lowStockItems;

  const stats = [
    {
      title: "Total Items",
      value: authLoading || loading ? "..." : totalItems.toString(),
      description: "Items in inventory",
      icon: Package,
      trend: `${totalItems} total`,
    },
    {
      title: "Low Stock Alerts",
      value: authLoading || loading ? "..." : lowStockItems.length.toString(),
      description: "Items below reorder point",
      icon: AlertCircle,
      trend: `${lowStockItems.length} items`,
    },
    {
      title: "Expiring Soon",
      value: authLoading || loading ? "..." : expiringSoonItems.length.toString(),
      description: "Items expiring in 7 days",
      icon: Clock,
      trend: `${expiringSoonItems.length} items`,
    },
    {
      title: "Restock Needed",
      value: authLoading || loading ? "..." : restockNeeded.toString(),
      description: "Recommended reorders",
      icon: TrendingUp,
      trend: `${restockNeeded} items`,
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            Overview of your inventory and key metrics
          </p>
        </div>
        <Button
          onClick={() => setShowAIAssistant(true)}
          size="sm"
          variant="outline"
          className="w-full sm:w-auto sm:h-10 shrink-0"
        >
          <Sparkles className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Ask AI</span>
          <span className="sm:hidden">AI</span>
        </Button>
      </div>

      <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6">
                <CardTitle className="text-[10px] xs:text-xs sm:text-sm font-medium truncate pr-1">
                  {stat.title}
                </CardTitle>
                <Icon className="h-3 w-3 sm:h-4 sm:w-4 md:h-4 md:w-4 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 md:p-6 md:pt-0">
                <div className="text-lg sm:text-xl md:text-2xl font-bold truncate">
                  {stat.value}
                </div>
                <p className="text-[10px] xs:text-xs text-muted-foreground hidden sm:block mt-1">
                  {stat.description}
                </p>
                <p className="text-[10px] xs:text-xs text-muted-foreground mt-1 truncate">
                  {stat.trend}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Recent Items</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Latest inventory additions</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {authLoading || loading ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {authLoading ? "Authenticating..." : "Loading..."}
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No items yet. Start by importing your inventory!
              </div>
            ) : (
              <div className="space-y-3">
                {items.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.invoice
                          ? `Invoice: ${item.invoice}`
                          : item.sku || "No SKU"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.quantity}</p>
                      <p className="text-xs text-muted-foreground">units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Low Stock Items</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Items needing attention</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {authLoading || loading ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {authLoading ? "Authenticating..." : "Loading..."}
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                ✅ All items are well stocked!
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Reorder at: {item.reorder_threshold}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-600">
                        {item.quantity}
                      </p>
                      <p className="text-xs text-amber-600">Low Stock!</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Expiring Soon</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Products expiring within 7 days</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {authLoading || loading ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {authLoading ? "Authenticating..." : "Loading..."}
              </div>
            ) : expiringSoonItems.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                🎉 No items expiring in the next week
              </div>
            ) : (
              <div className="space-y-3">
                {expiringSoonItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires in {daysUntilExpiration(item.expiration_date!)} days
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.quantity}</p>
                      <p className="text-xs text-muted-foreground">units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Restock Needed</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Below reorder threshold</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {authLoading || loading ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {authLoading ? "Authenticating..." : "Loading..."}
              </div>
            ) : restockItems.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                ✅ Nothing needs restocking right now
              </div>
            ) : (
              <div className="space-y-3">
                {restockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity} / Reorder at {item.reorder_threshold}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-600">Order soon</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showAIAssistant && orgId && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-2 md:p-4 z-[60] overflow-hidden">
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:my-auto sm:rounded-lg overflow-hidden flex flex-col">
            <AIAssistant
              orgId={orgId}
              onClose={() => setShowAIAssistant(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
