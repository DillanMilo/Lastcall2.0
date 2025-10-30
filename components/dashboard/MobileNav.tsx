"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { supabase } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  Package,
  Upload,
  Settings,
  LogOut,
  Loader2,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/import", label: "Import", icon: Upload },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await supabase.auth.signOut();
      router.push("/auth/signin");
    } catch (error) {
      console.error("Error signing out:", error);
      setSigningOut(false);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4 gap-1 p-2 pb-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="px-2 pb-2 pt-0">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
            signingOut
              ? "bg-muted text-muted-foreground"
              : "text-destructive hover:bg-destructive/10"
          )}
        >
          {signingOut ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing out
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4" />
              Sign out
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
