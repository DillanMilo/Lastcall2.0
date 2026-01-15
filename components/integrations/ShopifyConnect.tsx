"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ShoppingBag,
  Link2,
  Unlink,
  RefreshCw,
} from "lucide-react";
import { Organization } from "@/types";

interface ShopifyConnectProps {
  organization: Organization | null;
  onConnectionChange?: () => void;
}

interface SyncResult {
  success: boolean;
  results?: {
    created: number;
    updated: number;
    failed: number;
    errors: string[];
  };
  summary?: string;
  items_synced?: number;
  error?: string;
}

export function ShopifyConnect({
  organization,
  onConnectionChange,
}: ShopifyConnectProps) {
  const [storeDomain, setStoreDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const isConnected = !!organization?.shopify_store_domain;

  // Pre-fill form if already connected
  useEffect(() => {
    if (organization?.shopify_store_domain) {
      setStoreDomain(organization.shopify_store_domain);
    }
  }, [organization]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organization?.id) {
      setError("No organization found. Please create an organization first.");
      return;
    }

    if (!storeDomain || !accessToken) {
      setError("All fields are required");
      return;
    }

    setConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/integrations/shopify/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: organization.id,
          store_domain: storeDomain.trim(),
          access_token: accessToken.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Connection failed");
      }

      setSuccess(
        `Connected to ${data.store_info?.name || "Shopify"}! You can now sync your inventory.`
      );
      // Clear sensitive fields after successful connection
      setAccessToken("");
      onConnectionChange?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to Shopify";
      setError(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!organization?.id) return;

    const confirmed = window.confirm(
      "Are you sure you want to disconnect Shopify? This won't delete your existing inventory data."
    );

    if (!confirmed) return;

    setDisconnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/integrations/shopify/connect?org_id=${organization.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Disconnect failed");
      }

      setSuccess("Shopify disconnected successfully");
      setStoreDomain("");
      setAccessToken("");
      onConnectionChange?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to disconnect";
      setError(message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    if (!organization?.id) return;

    setSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch("/api/integrations/shopify/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: organization.id,
          enable_ai_labeling: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Sync failed");
      }

      setSyncResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sync inventory";
      setError(message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-[#96bf48]" />
          Shopify Integration
        </CardTitle>
        <CardDescription>
          {isConnected
            ? "Your Shopify store is connected. Sync inventory to keep your data up to date."
            : "Connect your Shopify store to automatically sync inventory."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        {isConnected && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Connected to Shopify
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Store: {organization?.shopify_store_domain}
                {organization?.shopify_connected_at && (
                  <> · Connected {new Date(organization.shopify_connected_at).toLocaleDateString()}</>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="shrink-0"
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        )}

        {/* Sync Results */}
        {syncResult && (
          <Alert className={syncResult.success ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-red-200 bg-red-50 dark:bg-red-950"}>
            {syncResult.success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription>
              {syncResult.success ? (
                <div className="space-y-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {syncResult.summary || "Sync completed successfully!"}
                  </p>
                  {syncResult.results && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Created: {syncResult.results.created} · Updated:{" "}
                      {syncResult.results.updated} · Failed:{" "}
                      {syncResult.results.failed}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-red-800 dark:text-red-200">
                  {syncResult.error || "Sync failed"}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Form */}
        {!isConnected && (
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-domain">Store Domain</Label>
              <Input
                id="store-domain"
                placeholder="mystore.myshopify.com"
                value={storeDomain}
                onChange={(e) => setStoreDomain(e.target.value)}
                disabled={connecting}
              />
              <p className="text-xs text-muted-foreground">
                Your Shopify store URL (e.g., mystore.myshopify.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-token">Admin API Access Token</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                disabled={connecting}
              />
              <p className="text-xs text-muted-foreground">
                Get this from your Shopify Admin → Apps → Develop apps
              </p>
            </div>

            <Button
              type="submit"
              disabled={connecting || !storeDomain || !accessToken}
              className="w-full sm:w-auto"
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect Shopify
                </>
              )}
            </Button>
          </form>
        )}

        {/* Disconnect Button */}
        {isConnected && (
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect Shopify
                </>
              )}
            </Button>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Help Section */}
        <div className="rounded-lg bg-muted/60 p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium">How to get your Shopify Admin API credentials:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to your Shopify Admin panel</li>
            <li>Navigate to Settings → Apps and sales channels → Develop apps</li>
            <li>Click "Create an app" and give it a name</li>
            <li>Configure Admin API scopes - enable these permissions:
              <ul className="ml-5 mt-1 list-disc list-inside">
                <li>read_products</li>
                <li>read_inventory</li>
              </ul>
            </li>
            <li>Install the app and copy the Admin API access token</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
