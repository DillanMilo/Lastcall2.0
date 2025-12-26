"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Package,
  Upload,
  Settings,
  LogOut,
  UserCircle,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/useAuth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/import", label: "Import", icon: Upload },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const { userWithOrg, orgId, signOut: authSignOut } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSignOut = async () => {
    // Clear AI chat history from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("ai-chat-")) {
        localStorage.removeItem(key);
      }
    });
    await authSignOut();
    window.location.href = "/auth/signin";
  };

  const handleSync = async () => {
    if (syncing || !orgId) return;

    setSyncing(true);
    setSyncStatus("idle");

    try {
      const response = await fetch("/api/integrations/bigcommerce/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Sync failed");
      }

      setSyncStatus("success");
      // Reload page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <nav className="flex flex-col h-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold">LastCall</h1>
        <p className="text-sm text-muted-foreground">Inventory Management</p>
      </div>

      <div className="flex-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 mb-1 transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* Sync Button */}
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start gap-3",
              syncStatus === "success" && "border-green-500 text-green-600 bg-green-500/10",
              syncStatus === "error" && "border-destructive text-destructive bg-destructive/10"
            )}
            onClick={handleSync}
            disabled={syncing || !orgId}
          >
            {syncing ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : syncStatus === "success" ? (
              <Check className="h-5 w-5" />
            ) : syncStatus === "error" ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">
              {syncing ? "Syncing..." : syncStatus === "success" ? "Synced!" : syncStatus === "error" ? "Sync Failed" : "Sync Now"}
            </span>
          </Button>
        </div>
      </div>

      <div className="p-3 border-t">
        {/* User Profile Preview */}
        {userWithOrg && (
          <Link href="/dashboard/settings">
            <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl hover:bg-accent transition-colors">
              {userWithOrg.organization ? (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {userWithOrg.organization.name?.charAt(0).toUpperCase() || "O"}
                  </span>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {userWithOrg.full_name || userWithOrg.email?.split("@")[0] || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  View Profile
                </p>
              </div>
            </div>
          </Link>
        )}

        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sign Out</span>
        </Button>
      </div>
    </nav>
  );
}
