"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/import", label: "Import", icon: Upload },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (userData) setUser(userData);
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const handleSignOut = async () => {
    // Clear AI chat history from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("ai-chat-")) {
        localStorage.removeItem(key);
      }
    });
    await supabase.auth.signOut();
    window.location.href = "/auth/signin";
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
      </div>

      <div className="p-3 border-t">
        {/* User Profile Preview */}
        {user && (
          <Link href="/dashboard/settings">
            <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl hover:bg-accent transition-colors">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.full_name || "User"}
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
