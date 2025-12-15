"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plug, CheckCircle, XCircle, Store, Link2, RefreshCw } from "lucide-react";
import {
  DEFAULT_FIELD_MAPPING,
  mapExternalItems,
  resolveItemsFromPayload,
  type FieldMapping,
} from "@/lib/inventory/apiImportUtils";
import { supabase } from "@/lib/supabaseClient";

interface SyncResult {
  summary: string;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

interface BigCommerceSyncResult {
  success: boolean;
  results?: {
    created: number;
    updated: number;
    failed: number;
    errors: string[];
  };
  summary?: string;
  error?: string;
}

const SOURCE_OPTIONS = [
  { label: "Shopify", value: "shopify" },
  { label: "Square", value: "square" },
  { label: "BigCommerce", value: "bigcommerce" },
  { label: "Custom", value: "custom" },
];

export function APIImporter({ orgId }: { orgId: string }) {
  const [source, setSource] = useState<string>("shopify");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [itemsPath, setItemsPath] = useState("items");
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({
    ...DEFAULT_FIELD_MAPPING,
  });
  const [enableAiLabeling, setEnableAiLabeling] = useState(true);
  const [connectionMode, setConnectionMode] =
    useState<"server" | "browser">("server");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  // BigCommerce-specific state
  const [bcStoreHash, setBcStoreHash] = useState("");
  const [bcClientId, setBcClientId] = useState("");
  const [bcAccessToken, setBcAccessToken] = useState("");
  const [bcConnecting, setBcConnecting] = useState(false);
  const [bcConnected, setBcConnected] = useState(false);
  const [bcStoreName, setBcStoreName] = useState<string | null>(null);
  const [bcSyncing, setBcSyncing] = useState(false);
  const [bcResult, setBcResult] = useState<BigCommerceSyncResult | null>(null);
  const [bcError, setBcError] = useState<string | null>(null);
  const [bcSuccess, setBcSuccess] = useState<string | null>(null);

  // Check if BigCommerce is already connected on mount
  useEffect(() => {
    const checkBigCommerceConnection = async () => {
      try {
        const { data: org, error } = await supabase
          .from('organizations')
          .select('bigcommerce_store_hash, bigcommerce_connected_at')
          .eq('id', orgId)
          .single();

        if (!error && org?.bigcommerce_connected_at) {
          setBcConnected(true);
          setBcStoreName(org.bigcommerce_store_hash || 'BigCommerce Store');
        }
      } catch (err) {
        console.error('Error checking BigCommerce connection:', err);
      }
    };

    if (orgId) {
      checkBigCommerceConnection();
    }
  }, [orgId]);

  const handleFieldChange = (field: keyof FieldMapping) => {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setFieldMapping((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };
  };

  // BigCommerce handlers
  const handleBcConnect = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!bcStoreHash || !bcClientId || !bcAccessToken) {
      setBcError("All fields are required");
      return;
    }

    setBcConnecting(true);
    setBcError(null);
    setBcSuccess(null);

    try {
      const response = await fetch("/api/integrations/bigcommerce/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          store_hash: bcStoreHash.trim(),
          client_id: bcClientId.trim(),
          access_token: bcAccessToken.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Connection failed");
      }

      setBcConnected(true);
      setBcStoreName(data.store_info?.name || bcStoreHash);
      setBcSuccess(`Connected to ${data.store_info?.name || "BigCommerce"}!`);
      setBcClientId("");
      setBcAccessToken("");
    } catch (err) {
      setBcError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setBcConnecting(false);
    }
  };

  const handleBcSync = async () => {
    setBcSyncing(true);
    setBcError(null);
    setBcResult(null);

    try {
      const response = await fetch("/api/integrations/bigcommerce/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          enable_ai_labeling: enableAiLabeling,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Sync failed");
      }

      setBcResult(data);
    } catch (err) {
      setBcError(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setBcSyncing(false);
    }
  };

  const buildSyncResult = (payload: unknown): SyncResult => {
    const fallback: SyncResult = {
      summary: "Sync completed.",
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return fallback;
    }

    const safePayload = payload as Partial<{
      summary: string;
      results: Partial<SyncResult>;
    }>;

    return {
      summary: safePayload.summary ?? fallback.summary,
      created: safePayload.results?.created ?? fallback.created,
      updated: safePayload.results?.updated ?? fallback.updated,
      failed: safePayload.results?.failed ?? fallback.failed,
      errors: Array.isArray(safePayload.results?.errors)
        ? safePayload.results.errors
        : fallback.errors,
    };
  };

  const syncWithBackend = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/inventory/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const syncData = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        syncData?.error || `Sync failed with status ${response.status}.`;
      throw new Error(message);
    }

    setResult(buildSyncResult(syncData));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!apiUrl) {
      setError("Provide an API endpoint URL to fetch inventory data.");
      return;
    }

    setSyncing(true);

    try {
      const normalizedItemsPath = itemsPath.trim();
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (apiKey.trim()) {
        headers.Authorization = `Bearer ${apiKey.trim()}`;
      }

      if (connectionMode === "server") {
        const proxyResponse = await fetch("/api/inventory/import-proxy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            org_id: orgId,
            source,
            apiUrl,
            apiKey: apiKey.trim() || null,
            itemsPath: normalizedItemsPath || null,
            fieldMapping,
            enable_ai_labeling: enableAiLabeling,
          }),
        });

        const proxyData = await proxyResponse.json().catch(() => null);

        if (!proxyResponse.ok) {
          const message =
            proxyData?.error ||
            `Server proxy failed with status ${proxyResponse.status}.`;
          throw new Error(message);
        }

        setResult(buildSyncResult(proxyData));
        return;
      }

      const externalResponse = await fetch(apiUrl, {
        headers,
      });

      if (!externalResponse.ok) {
        throw new Error(
          `Failed to fetch API: ${externalResponse.status} ${externalResponse.statusText}`
        );
      }

      const payload = await externalResponse.json();

      const rawItems = resolveItemsFromPayload(payload, normalizedItemsPath);
      const mappedItems = mapExternalItems(rawItems, fieldMapping);

      await syncWithBackend({
        org_id: orgId,
        source,
        items: mappedItems,
        enable_ai_labeling: enableAiLabeling,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sync inventory via API.";
      setError(message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-2xl flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          Connect via API
        </CardTitle>
        <CardDescription className="text-sm">
          Pull inventory from your own API and sync it directly to LastCall.
          Provide an endpoint that returns JSON data with one object per item.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-6">
        {/* Connection Mode - Hide for BigCommerce */}
        {source !== "bigcommerce" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-dashed border-border p-4">
            <div>
              <p className="text-sm font-medium">Connection Mode</p>
              <p className="text-xs text-muted-foreground">
                Server mode avoids browser CORS limits by proxying through Next.js.
              </p>
            </div>
            <div className="inline-flex rounded-full border border-muted bg-muted/40 p-1">
              <Button
                type="button"
                size="sm"
                variant={connectionMode === "server" ? "default" : "ghost"}
                className="rounded-full"
                onClick={() => setConnectionMode("server")}
              >
                Server Proxy
              </Button>
              <Button
                type="button"
                size="sm"
                variant={connectionMode === "browser" ? "default" : "ghost"}
                className="rounded-full"
                onClick={() => setConnectionMode("browser")}
              >
                Direct Fetch
              </Button>
            </div>
          </div>
        )}

        {/* Source Selector - Always visible */}
        <div className="space-y-2">
          <Label htmlFor="api-source">Source</Label>
          <select
            id="api-source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setError(null);
              setResult(null);
              setBcError(null);
              setBcResult(null);
              setBcSuccess(null);
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* BigCommerce Form - Only when BigCommerce is selected */}
        {source === "bigcommerce" && (
          <div className="space-y-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">BigCommerce Connection</h3>
            </div>

            {/* Connected State */}
            {bcConnected && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Connected to {bcStoreName || "BigCommerce"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBcSync}
                  disabled={bcSyncing}
                  className="shrink-0"
                >
                  {bcSyncing ? (
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

            {/* Connection Form - Only when not connected */}
            {!bcConnected && (
              <form onSubmit={handleBcConnect} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="bc-store-hash">Store Hash</Label>
                    <Input
                      id="bc-store-hash"
                      placeholder="abc123"
                      value={bcStoreHash}
                      onChange={(e) => setBcStoreHash(e.target.value)}
                      disabled={bcConnecting}
                    />
                    <p className="text-xs text-muted-foreground">
                      Found in BigCommerce Admin → Advanced Settings → API Accounts
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bc-client-id">Client ID</Label>
                    <Input
                      id="bc-client-id"
                      placeholder="Enter your Client ID"
                      value={bcClientId}
                      onChange={(e) => setBcClientId(e.target.value)}
                      disabled={bcConnecting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bc-access-token">Access Token</Label>
                    <Input
                      id="bc-access-token"
                      type="password"
                      placeholder="Enter your Access Token"
                      value={bcAccessToken}
                      onChange={(e) => setBcAccessToken(e.target.value)}
                      disabled={bcConnecting}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Make sure the token has read/write access to Products and Inventory
                </p>

                <Button
                  type="submit"
                  disabled={bcConnecting || !bcStoreHash || !bcClientId || !bcAccessToken}
                  className="w-full sm:w-auto"
                >
                  {bcConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Connect & Sync
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* BigCommerce Sync Results */}
            {bcResult && (
              <Alert className={bcResult.success ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-red-200 bg-red-50 dark:bg-red-950"}>
                {bcResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription>
                  {bcResult.success ? (
                    <div className="space-y-1">
                      <p className="font-medium text-green-800 dark:text-green-200">
                        {bcResult.summary || "Sync completed!"}
                      </p>
                      {bcResult.results && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Created: {bcResult.results.created} · Updated: {bcResult.results.updated} · Failed: {bcResult.results.failed}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-red-800 dark:text-red-200">{bcResult.error || "Sync failed"}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {bcError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{bcError}</AlertDescription>
              </Alert>
            )}

            {bcSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {bcSuccess}
                </AlertDescription>
              </Alert>
            )}

            {/* Help Section */}
            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-medium">How to get your BigCommerce credentials:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to BigCommerce Admin → Advanced Settings → API Accounts</li>
                <li>Click &quot;Create API Account&quot; → &quot;Create V2/V3 API Token&quot;</li>
                <li>Enable Products (read/modify) and Store Inventory (read/modify) scopes</li>
                <li>Copy the Store Hash, Client ID, and Access Token</li>
              </ol>
            </div>
          </div>
        )}

        {/* Regular API Form - Only when NOT BigCommerce */}
        {source !== "bigcommerce" && (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api-url">API Endpoint URL</Label>
                <Input
                  id="api-url"
                  type="url"
                  placeholder="https://your-api.com/inventory"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">API Key (optional)</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Key will be sent as Bearer token"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="items-path">Items Path (optional)</Label>
                <Input
                  id="items-path"
                  placeholder="items or data.inventory"
                  value={itemsPath}
                  onChange={(e) => setItemsPath(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use dot notation to locate the array of items. Leave blank if
                  the API returns an array at the root level.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="field-name">Name Field</Label>
                <Input
                  id="field-name"
                  value={fieldMapping.name}
                  onChange={handleFieldChange("name")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-sku">SKU Field</Label>
                <Input
                  id="field-sku"
                  value={fieldMapping.sku}
                  onChange={handleFieldChange("sku")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-quantity">Quantity Field</Label>
                <Input
                  id="field-quantity"
                  value={fieldMapping.quantity}
                  onChange={handleFieldChange("quantity")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-invoice">Invoice Field</Label>
                <Input
                  id="field-invoice"
                  value={fieldMapping.invoice}
                  onChange={handleFieldChange("invoice")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-reorder">Reorder Threshold Field</Label>
                <Input
                  id="field-reorder"
                  value={fieldMapping.reorder_threshold}
                  onChange={handleFieldChange("reorder_threshold")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-expiration">Expiration Date Field</Label>
                <Input
                  id="field-expiration"
                  value={fieldMapping.expiration_date}
                  onChange={handleFieldChange("expiration_date")}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-dashed border-border p-4">
              <div>
                <p className="text-sm font-medium">AI Labeling</p>
                <p className="text-xs text-muted-foreground">
                  Auto-generate categories and AI descriptions for new items.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={enableAiLabeling}
                  onChange={(e) => setEnableAiLabeling(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="relative h-6 w-11 rounded-full bg-muted peer-checked:bg-primary transition-colors">
                  <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-background shadow transition-all peer-checked:translate-x-5" />
                </div>
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="submit" disabled={syncing} className="w-full sm:w-auto">
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  "Fetch & Sync"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {connectionMode === "server" ? (
                  <>
                    We proxy your request through <code>/api/inventory/import-proxy</code> to
                    avoid browser CORS limits, then call <code>/api/inventory/sync</code> on the server.
                  </>
                ) : (
                  <>
                    We send a POST request to <code>/api/inventory/sync</code> with your mapped items and
                    organization ID.
                  </>
                )}
              </p>
            </div>
          </form>
        )}

        {/* Regular API Error/Results - Only for non-BigCommerce */}
        {source !== "bigcommerce" && error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {source !== "bigcommerce" && result && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="space-y-1">
              <p>{result.summary}</p>
              <p className="text-sm">
                Created: {result.created} · Updated: {result.updated} · Failed:{" "}
                {result.failed}
              </p>
              {result.errors.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {result.errors.map((errMsg, idx) => (
                    <p key={idx}>• {errMsg}</p>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Reference section - Only for non-BigCommerce */}
        {source !== "bigcommerce" && (
          <div className="rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground">
            <p className="font-medium mb-2">Need a reference?</p>
            <p>
              Your API should return JSON data shaped like:
            </p>
            <pre className="mt-2 rounded-lg bg-background p-3 text-[11px] leading-tight text-foreground shadow-inner">
{`[
  {
    "name": "Angus Biltong Chili 100g",
    "sku": "ANG-CHILI-100",
    "quantity": 200,
    "invoice": "INV-12345",
    "reorder_threshold": 40,
    "expiration_date": "2025-07-31"
  }
]`}
            </pre>
            <p className="mt-2">
              Adjust the field names above to match your API and we will handle the
              rest.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
