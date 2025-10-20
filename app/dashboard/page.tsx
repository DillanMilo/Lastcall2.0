"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle, TrendingUp, Clock } from "lucide-react";

export default function DashboardPage() {
  // Mock data - will be replaced with real data from Supabase
  const stats = [
    {
      title: "Total Items",
      value: "0",
      description: "Items in inventory",
      icon: Package,
      trend: "+0%",
    },
    {
      title: "Low Stock Alerts",
      value: "0",
      description: "Items below reorder point",
      icon: AlertCircle,
      trend: "0 items",
    },
    {
      title: "Expiring Soon",
      value: "0",
      description: "Items expiring in 7 days",
      icon: Clock,
      trend: "0 items",
    },
    {
      title: "Restock Needed",
      value: "0",
      description: "Recommended reorders",
      icon: TrendingUp,
      trend: "0 items",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your inventory and key metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
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
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest inventory updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              No recent activity. Start by importing your inventory!
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <a
              href="/dashboard/import"
              className="text-sm text-primary hover:underline"
            >
              → Import CSV
            </a>
            <a
              href="/dashboard/inventory"
              className="text-sm text-primary hover:underline"
            >
              → View Inventory
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

