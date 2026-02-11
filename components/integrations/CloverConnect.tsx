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
  CreditCard,
  Link2,
  Unlink,
  RefreshCw,
} from "lucide-react";
import { Organization } from "@/types";

interface CloverConnectProps {
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
  itemsFound?: number;
  error?: string;
}

export function CloverConnect({
  organization,
  onConnectionChange,
}: CloverConnectProps) {
  const [merchantId, setMerchantId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [environment, setEnvironment] = useState<"us" | "eu">("us");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const isConnected = !!organization?.clover_merchant_id;

  useEffect(() => {
    if (organization?.clover_merchant_id) {
      setMerchantId(organization.clover_merchant_id);
    }
  }, [organization]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organization?.id) {
      setError("No organization found. Please create an organization first.");
      return;
    }

    if (!merchantId || !accessToken) {
      setError("Merchant ID and Access Token are required");
      return;
    }

    setConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/integrations/clover/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          merchant_id: merchantId.trim(),
          access_token: accessToken.trim(),
          environment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Connection failed");
      }

      setSuccess(
        `Connected to ${data.merchantName || "Clover"}! You can now sync your inventory.`
      );
      setAccessToken("");
      onConnectionChange?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to Clover";
      setError(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!organization?.id) return;

    const confirmed = window.confirm(
      "Are you sure you want to disconnect Clover? This won't delete your existing inventory data."
    );

    if (!confirmed) return;

    setDisconnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/integrations/clover/connect", {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Disconnect failed");
      }

      setSuccess("Clover disconnected successfully");
      setMerchantId("");
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
      const response = await fetch("/api/integrations/clover/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enableAiLabeling: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
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
          <CreditCard className="h-5 w-5 text-green-600" />
          Clover POS Integration
        </CardTitle>
        <CardDescription>
          {isConnected
            ? "Your Clover POS is connected. Sync inventory to keep your data up to date."
            : "Connect your Clover POS to automatically sync inventory and track sales."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        {isConnected && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Connected to Clover
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Merchant: {organization?.clover_merchant_id}
                {organization?.clover_connected_at && (
                  <>
                    {" "}
                    · Connected{" "}
                    {new Date(
                      organization.clover_connected_at
                    ).toLocaleDateString()}
                  </>
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

        {/* Validation Mode Warning */}
        {isConnected && organization?.thrive_validation_mode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Thrive validation mode is active. Push to Clover is disabled.
              Syncs and webhooks are still being captured.
            </p>
          </div>
        )}

        {/* Sync Results */}
        {syncResult && (
          <Alert
            className={
              syncResult.success
                ? "border-green-200 bg-green-50 dark:bg-green-950"
                : "border-red-200 bg-red-50 dark:bg-red-950"
            }
          >
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
                      {syncResult.itemsFound !== undefined && (
                        <> · Items found in Clover: {syncResult.itemsFound}</>
                      )}
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
              <Label htmlFor="clover-merchant-id">Merchant ID</Label>
              <Input
                id="clover-merchant-id"
                placeholder="XXXXXXXXXX"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                disabled={connecting}
              />
              <p className="text-xs text-muted-foreground">
                Found in your Clover Dashboard under Account & Setup
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clover-access-token">API Access Token</Label>
              <Input
                id="clover-access-token"
                type="password"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                disabled={connecting}
              />
              <p className="text-xs text-muted-foreground">
                Get this from the Clover Developer Portal for your app
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clover-environment">Region</Label>
              <select
                id="clover-environment"
                value={environment}
                onChange={(e) =>
                  setEnvironment(e.target.value as "us" | "eu")
                }
                disabled={connecting}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="us">US / Canada</option>
                <option value="eu">Europe</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={connecting || !merchantId || !accessToken}
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
                  Connect Clover
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
                  Disconnect Clover
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
          <p className="font-medium">How to get your Clover API credentials:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Log in to your Clover Dashboard</li>
            <li>Go to Account & Setup to find your Merchant ID</li>
            <li>
              Visit the Clover Developer Portal and create an app (or use an
              existing one)
            </li>
            <li>
              Generate an API token with these permissions:
              <ul className="ml-5 mt-1 list-disc list-inside">
                <li>Read inventory</li>
                <li>Read/write items</li>
                <li>Read orders (for sales tracking)</li>
              </ul>
            </li>
            <li>Copy the Access Token</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
