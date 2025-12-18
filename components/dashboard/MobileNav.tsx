"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { LayoutDashboard, Package, Upload, Settings, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/import", label: "Import", icon: Upload },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

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

  const closeMenu = () => setIsOpen(false);

  return (
    <div className="md:hidden">
      {/* Hamburger Button - Fixed at top right */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-3 right-3 z-50 h-10 w-10 bg-card shadow-md"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeMenu}
        />
      )}

      {/* Dropdown Menu */}
      <nav
        className={cn(
          "fixed top-14 right-3 z-50 w-56 bg-card border rounded-xl shadow-lg transition-all duration-200 ease-in-out",
          isOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2 pointer-events-none"
        )}
      >
        <div className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link key={item.href} href={item.href} onClick={closeMenu}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
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

          <div className="border-t my-1" />

          <button
            onClick={() => {
              closeMenu();
              handleSignOut();
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 w-full transition-colors hover:bg-accent hover:text-accent-foreground text-destructive"
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
