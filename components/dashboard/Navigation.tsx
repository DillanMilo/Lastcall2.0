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
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/useAuth";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

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
    try {
      // Clear AI chat history from localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("ai-chat-")) {
          localStorage.removeItem(key);
        }
      });

      await authSignOut();

      // Force a hard navigation to clear all client state
      window.location.replace("/auth/signin");
    } catch (error) {
      console.error("Sign out error:", error);
      // Force redirect even on error
      window.location.replace("/auth/signin");
    }
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
    <nav className="flex flex-col h-full bg-card">
      {/* Brand Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">LastCallIQ</h1>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Inventory</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 space-y-1">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Menu
        </p>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                  "animate-fade-up opacity-0",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
              >
                <Icon className={cn(
                  "h-[18px] w-[18px] transition-transform duration-200",
                  !isActive && "group-hover:scale-110"
                )} />
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground/70" />
                )}
              </div>
            </Link>
          );
        })}

        {/* Sync Section */}
        <div className="pt-4 mt-4 border-t border-border/50">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Actions
          </p>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 font-normal",
              syncStatus === "success" && "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10",
              syncStatus === "error" && "text-destructive bg-destructive/10"
            )}
            onClick={handleSync}
            disabled={syncing || !orgId}
          >
            {syncing ? (
              <RefreshCw className="h-[18px] w-[18px] animate-spin" />
            ) : syncStatus === "success" ? (
              <Check className="h-[18px] w-[18px]" />
            ) : syncStatus === "error" ? (
              <AlertCircle className="h-[18px] w-[18px]" />
            ) : (
              <RefreshCw className="h-[18px] w-[18px]" />
            )}
            <span className="text-sm">
              {syncing ? "Syncing..." : syncStatus === "success" ? "Synced!" : syncStatus === "error" ? "Sync Failed" : "Sync Inventory"}
            </span>
          </Button>
        </div>
      </div>

      {/* User Section */}
      <div className="p-3 border-t border-border/50 bg-muted/30">
        {/* Organization Switcher - only shows if user has multiple orgs */}
        <div className="mb-2">
          <OrganizationSwitcher />
        </div>

        {userWithOrg && (
          <Link href="/dashboard/settings">
            <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg hover:bg-background/60 transition-colors group">
              {userWithOrg.organization ? (
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                  <span className="text-sm font-semibold text-primary">
                    {userWithOrg.organization.name?.charAt(0).toUpperCase() || "O"}
                  </span>
                </div>
              ) : (
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {userWithOrg.full_name || userWithOrg.email?.split("@")[0] || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userWithOrg.organization?.name || "View Profile"}
                </p>
              </div>
            </div>
          </Link>
        )}

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span className="text-sm font-medium">Sign Out</span>
        </Button>
      </div>
    </nav>
  );
}
