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
  Menu,
  X,
  RefreshCw,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/useAuth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/import", label: "Import", icon: Upload },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const { userWithOrg, orgId, signOut: authSignOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSignOut = async () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("ai-chat-")) {
          localStorage.removeItem(key);
        }
      });
      await authSignOut();
      window.location.href = "/auth/signin";
    } catch (error) {
      console.error("Error during sign out:", error);
      window.location.href = "/auth/signin";
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

  const closeMenu = () => setIsOpen(false);

  return (
    <div className="md:hidden">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-14 bg-card/95 backdrop-blur-md border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-lg">LastCall</span>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-9 w-9"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-fade-in"
          onClick={closeMenu}
        />
      )}

      {/* Dropdown Menu */}
      <nav
        className={cn(
          "fixed top-14 left-0 right-0 z-50 mx-3 mt-2 bg-card border rounded-xl shadow-xl transition-all duration-300 ease-out overflow-hidden",
          isOpen
            ? "opacity-100 translate-y-0 max-h-[calc(100vh-80px)]"
            : "opacity-0 -translate-y-4 max-h-0 pointer-events-none"
        )}
      >
        <div className="p-3">
          {/* User Info */}
          {userWithOrg && (
            <Link href="/dashboard/settings" onClick={closeMenu}>
              <div className="flex items-center gap-3 p-3 mb-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                {userWithOrg.organization ? (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-base font-semibold text-primary">
                      {userWithOrg.organization.name?.charAt(0).toUpperCase() || "O"}
                    </span>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <span className="text-base font-semibold text-muted-foreground">U</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {userWithOrg.full_name || userWithOrg.email?.split("@")[0] || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {userWithOrg.organization?.name || "Personal Account"}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Nav Items */}
          <div className="space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href} onClick={closeMenu}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-200",
                      "animate-fade-up opacity-0",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-primary-foreground/70" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="my-3 border-t" />

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing || !orgId}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-3 w-full transition-all duration-200",
              syncStatus === "success"
                ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                : syncStatus === "error"
                ? "bg-destructive/10 text-destructive"
                : "text-foreground hover:bg-muted",
              !orgId && "opacity-50 cursor-not-allowed"
            )}
            aria-label="Sync Inventory"
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
              {syncing ? "Syncing..." : syncStatus === "success" ? "Synced!" : syncStatus === "error" ? "Sync Failed" : "Sync Inventory"}
            </span>
          </button>

          <div className="my-3 border-t" />

          {/* Sign Out */}
          <button
            onClick={() => {
              closeMenu();
              handleSignOut();
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-3 w-full transition-colors text-destructive hover:bg-destructive/10"
            aria-label="Sign Out"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
