"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { InventoryItem } from "@/types";
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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const orgId = "00000000-0000-0000-0000-000000000001";
  const isSupabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("placeholder") &&
    String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) !== "placeholder-key";

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
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
        .select("*");

      if (error) {
        console.error("Error fetching inventory:", {
          message: (error as any)?.message,
          status: (error as any)?.status,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          original: error,
        });
        setItems([]);
      } else {
        setItems(data || []);
      }
    } catch (error) {
      console.error("Unexpected error fetching inventory:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

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

  const stats = [
    {
      title: "Total Items",
      value: loading ? "..." : totalItems.toString(),
      description: "Items in inventory",
      icon: Package,
      trend: `${totalItems} total`,
    },
    {
      title: "Low Stock Alerts",
      value: loading ? "..." : lowStockItems.length.toString(),
      description: "Items below reorder point",
      icon: AlertCircle,
      trend: `${lowStockItems.length} items`,
    },
    {
      title: "Expiring Soon",
      value: loading ? "..." : expiringSoonItems.length.toString(),
      description: "Items expiring in 7 days",
      icon: Clock,
      trend: `${expiringSoonItems.length} items`,
    },
    {
      title: "Restock Needed",
      value: loading ? "..." : restockNeeded.toString(),
      description: "Recommended reorders",
      icon: TrendingUp,
      trend: `${restockNeeded} items`,
    },
  ];

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Overview of your inventory and key metrics
          </p>
        </div>
        <Button
          onClick={() => setShowAIAssistant(true)}
          size="sm"
          variant="outline"
          className="md:h-10"
        >
          <Sparkles className="h-4 w-4 md:mr-2" />
          <span className="hidden sm:inline">Ask AI</span>
        </Button>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                <div className="text-xl md:text-2xl font-bold">
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {stat.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.trend}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Items</CardTitle>
            <CardDescription>Latest inventory additions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Loading...
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
          <CardHeader>
            <CardTitle>Low Stock Items</CardTitle>
            <CardDescription>Items needing attention</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Loading...
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

      {showAIAssistant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 md:p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-2xl my-auto">
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
