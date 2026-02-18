"use client";

import { useState, useEffect, useCallback } from "react";
import { CSVImporter } from "@/components/forms/CSVImporter";
import { APIImporter } from "@/components/forms/APIImporter";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Code2, Lightbulb } from "lucide-react";

export default function ImportPage() {
  const [orgId, setOrgId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchUserOrg = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
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
  }, []);

  useEffect(() => {
    fetchUserOrg();
  }, [fetchUserOrg]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Import Data
            </h1>
            <p className="text-sm text-muted-foreground">
              Bulk upload or sync your inventory
            </p>
          </div>
        </div>
      </div>

      {/* Import Options Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CSV Import */}
        <div
          className="animate-fade-up opacity-0"
          style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
        >
          <Card variant="default" className="h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-[hsl(var(--success))]" />
                </div>
                <div>
                  <CardTitle className="text-lg">CSV Upload</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Upload a spreadsheet file
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CSVImporter orgId={orgId} />
            </CardContent>
          </Card>
        </div>

        {/* API Import */}
        <div
          className="animate-fade-up opacity-0"
          style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
        >
          <Card variant="default" className="h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Code2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">API Sync</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Connect external systems
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <APIImporter orgId={orgId} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CSV Guide */}
      <Card
        variant="filled"
        className="animate-fade-up opacity-0"
        style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--warning))]/20 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-4 h-4 text-[hsl(var(--warning))]" />
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm">CSV Format Guide</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your file should include these columns:
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="text-sm">
                  <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">name</span>
                  <span className="text-muted-foreground ml-2">Required</span>
                </div>
                <div className="text-sm">
                  <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">sku</span>
                  <span className="text-muted-foreground ml-2">Optional</span>
                </div>
                <div className="text-sm">
                  <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">invoice</span>
                  <span className="text-muted-foreground ml-2">Batch ID</span>
                </div>
                <div className="text-sm">
                  <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">quantity</span>
                  <span className="text-muted-foreground ml-2">Stock count</span>
                </div>
                <div className="text-sm">
                  <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">reorder_threshold</span>
                  <span className="text-muted-foreground ml-2">Min qty</span>
                </div>
                <div className="text-sm">
                  <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">expiration_date</span>
                  <span className="text-muted-foreground ml-2">YYYY-MM-DD</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Pro tip:</span> Use the same invoice number for products
                  from the same batch to easily track and edit them together.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
