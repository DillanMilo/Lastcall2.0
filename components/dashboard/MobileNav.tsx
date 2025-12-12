"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { LayoutDashboard, Package, Upload, Settings, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/import", label: "Import", icon: Upload },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const handleSignOut = async () => {
    try {
      // Clear AI chat history from localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("ai-chat-")) {
          localStorage.removeItem(key);
        }
      });
      await supabase.auth.signOut();
      window.location.href = "/auth/signin";
    } catch (error) {
      console.error("Error during sign out:", error);
      window.location.href = "/auth/signin";
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden safe-bottom mobile-nav transition-transform duration-300">
      <div className="grid grid-cols-5 gap-1 p-2 safe-left safe-right">
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
        <button
          onClick={handleSignOut}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
          )}
          aria-label="Sign Out"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
