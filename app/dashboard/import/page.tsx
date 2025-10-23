"use client";

import { useState, useEffect } from "react";
import { CSVImporter } from "@/components/forms/CSVImporter";
import { supabase } from "@/lib/supabaseClient";

export default function ImportPage() {
  const [orgId, setOrgId] = useState<string>(
    "00000000-0000-0000-0000-000000000001"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserOrg = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Get user's organization
        const { data: userData } = await supabase
          .from("users")
          .select("org_id")
          .eq("id", user.id)
          .single();

        if (userData?.org_id) {
          setOrgId(userData.org_id);
        }
      }
    } catch (error) {
      console.error("Error fetching user org:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Import Data
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Upload a CSV file to add items to your inventory
        </p>
      </div>

      <CSVImporter orgId={orgId} />

      <div className="mt-6 md:mt-8 p-3 md:p-4 bg-muted rounded-2xl">
        <h3 className="text-sm md:text-base font-semibold mb-2">
          CSV Format Guide
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Your CSV file should include the following columns:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>
            <strong>name</strong> (required) - Product name
          </li>
          <li>
            <strong>sku</strong> (optional) - Stock keeping unit
          </li>
          <li>
            <strong>invoice</strong> (optional) - Invoice/batch number for
            tracking lots
          </li>
          <li>
            <strong>quantity</strong> (optional) - Current stock quantity
          </li>
          <li>
            <strong>reorder_threshold</strong> (optional) - Minimum quantity
            before reorder
          </li>
          <li>
            <strong>expiration_date</strong> (optional) - Format: YYYY-MM-DD
          </li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3">
          Example:{" "}
          <code className="bg-background px-2 py-1 rounded">
            name,sku,invoice,quantity,reorder_threshold,expiration_date
          </code>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Tip: Use the same invoice number for products from the same batch
          to easily track and edit them together!
        </p>
      </div>
    </div>
  );
}
