"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";

export function OrganizationSwitcher() {
  const { userWithOrg, organizations, switchOrganization } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  // Don't show if user only has one organization or no organizations
  if (!organizations || organizations.length <= 1) {
    return null;
  }

  const currentOrg = userWithOrg?.organization;

  const handleSwitch = async (orgId: string) => {
    if (orgId === userWithOrg?.org_id) {
      setIsOpen(false);
      return;
    }

    setSwitching(orgId);
    const success = await switchOrganization(orgId);
    setSwitching(null);

    if (success) {
      setIsOpen(false);
      // Reload to refresh all data for the new org
      window.location.reload();
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="w-full justify-between gap-2 px-3 py-2 h-auto"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-xs text-muted-foreground">Organization</p>
            <p className="text-sm font-medium truncate">
              {currentOrg?.name || "Select org"}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="p-1.5 max-h-64 overflow-y-auto">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Your Organizations
              </p>
              {organizations.map((membership) => {
                const isActive = membership.org_id === userWithOrg?.org_id;
                const isLoading = switching === membership.org_id;

                return (
                  <button
                    key={membership.org_id}
                    onClick={() => handleSwitch(membership.org_id)}
                    disabled={isLoading}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors",
                      "hover:bg-muted focus:bg-muted focus:outline-none",
                      isActive && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <span className="text-sm font-semibold">
                        {membership.organization?.name?.charAt(0).toUpperCase() || "O"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate">
                        {membership.organization?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {membership.role}
                      </p>
                    </div>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : isActive ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
