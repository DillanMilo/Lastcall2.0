"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Play,
  Square,
  RefreshCw,
  ArrowDownUp,
  ClipboardList,
  Package,
  Activity,
  Clock,
} from "lucide-react";
import { Organization } from "@/types";

interface ThriveValidationProps {
  organization: Organization | null;
  onStatusChange?: () => void;
}

interface ValidationReport {
  validation_status: {
    active: boolean;
    started_at: string | null;
    ended_at: string | null;
    clover_connected: boolean;
    clover_connected_at: string | null;
  };
  summary: {
    total_clover_items: number;
    total_history_events: number;
    webhook_events: number;
    sync_events: number;
    validation_events: number;
    total_sales_decrement: number;
    total_restocks: number;
    tracking_since: string;
  };
  items: Array<{
    id: string;
    name: string;
    sku: string | null;
    current_quantity: number;
    clover_item_id: string;
    category: string | null;
    ai_label: string | null;
    last_restock: string;
    created_at: string;
  }>;
  recent_history: Array<{
    item_name: string;
    sku: string | null;
    previous_quantity: number;
    new_quantity: number;
    change: number;
    type: string;
    source: string;
    timestamp: string;
  }>;
}

export function ThriveValidation({
  organization,
  onStatusChange,
}: ThriveValidationProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isCloverConnected = !!organization?.clover_merchant_id;
  const isValidationActive = organization?.thrive_validation_mode === true;

  const fetchReport = useCallback(async () => {
    if (!isCloverConnected) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/integrations/clover/thrive-validation",
        { credentials: "include" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch validation report");
      }

      setReport(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load report";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isCloverConnected]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleToggleValidation = async (enable: boolean) => {
    setToggling(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        "/api/integrations/clover/thrive-validation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ enable }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle validation mode");
      }

      setSuccess(data.message);
      onStatusChange?.();
      // Refresh report
      await fetchReport();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to toggle validation mode";
      setError(message);
    } finally {
      setToggling(false);
    }
  };

  if (!isCloverConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            Thrive Validation Mode
          </CardTitle>
          <CardDescription>
            Connect Clover first to enable Thrive validation mode for parallel
            data capture.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card
      className={
        isValidationActive
          ? "border-amber-500/50 bg-amber-500/5"
          : ""
      }
    >
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck
                className={`h-5 w-5 ${isValidationActive ? "text-amber-500" : "text-muted-foreground"}`}
              />
              Thrive Validation Mode
              {isValidationActive && (
                <Badge className="bg-amber-500 hover:bg-amber-600 ml-2">
                  Active
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {isValidationActive
                ? "LastCallIQ is running in read-only mode alongside Thrive. All Clover data is being captured for comparison."
                : "Run LastCallIQ alongside Thrive to verify data capture before migration."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReport}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {isValidationActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleValidation(false)}
                disabled={toggling}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {toggling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="mr-2 h-4 w-4" />
                    End Validation
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => handleToggleValidation(true)}
                disabled={toggling}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {toggling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Validation
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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

        {/* Validation Active Banner */}
        {isValidationActive && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Parallel Run Active
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  LastCallIQ is capturing all Clover data (syncs + webhooks) in
                  read-only mode. Push to Clover is disabled to avoid interfering
                  with Thrive. Compare the data below with what Thrive shows to
                  verify accuracy.
                </p>
                {report?.validation_status.started_at && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2">
                    <Clock className="h-3 w-3" />
                    Started{" "}
                    {new Date(
                      report.validation_status.started_at
                    ).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <Package className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">
                {report.summary.total_clover_items}
              </p>
              <p className="text-xs text-muted-foreground">Clover Items</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <ArrowDownUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">
                {report.summary.total_history_events}
              </p>
              <p className="text-xs text-muted-foreground">Events Captured</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Activity className="h-4 w-4 mx-auto text-red-500 mb-1" />
              <p className="text-2xl font-bold text-red-600">
                {report.summary.total_sales_decrement}
              </p>
              <p className="text-xs text-muted-foreground">Units Sold</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Activity className="h-4 w-4 mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold text-green-600">
                {report.summary.total_restocks}
              </p>
              <p className="text-xs text-muted-foreground">Units Restocked</p>
            </div>
          </div>
        )}

        {/* Event breakdown */}
        {report && (
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Event Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Webhook Events</span>
                <span className="font-medium">
                  {report.summary.webhook_events}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Sync Events</span>
                <span className="font-medium">
                  {report.summary.sync_events}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Validation Logs</span>
                <span className="font-medium">
                  {report.summary.validation_events}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tracking since{" "}
              {new Date(report.summary.tracking_since).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Current Inventory Snapshot */}
        {report && report.items.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              Current Clover Inventory Snapshot ({report.items.length} items)
            </h4>
            <p className="text-xs text-muted-foreground">
              Compare these quantities with what Thrive shows to verify
              LastCallIQ is capturing everything correctly.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Item</th>
                    <th className="text-left p-2 font-medium">SKU</th>
                    <th className="text-right p-2 font-medium">Qty</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell">
                      Category
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="p-2 truncate max-w-[200px]">
                        {item.name}
                      </td>
                      <td className="p-2 text-muted-foreground font-mono text-xs">
                        {item.sku || "-"}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {item.current_quantity}
                      </td>
                      <td className="p-2 text-muted-foreground text-xs hidden sm:table-cell">
                        {item.category || item.ai_label || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Activity Log */}
        {report && report.recent_history.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              Recent Activity (last {report.recent_history.length} events)
            </h4>
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Item</th>
                    <th className="text-right p-2 font-medium">Change</th>
                    <th className="text-left p-2 font-medium">Source</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.recent_history.map((event, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="p-2 truncate max-w-[160px]">
                        {event.item_name}
                      </td>
                      <td
                        className={`p-2 text-right font-medium ${
                          event.change < 0
                            ? "text-red-600"
                            : event.change > 0
                              ? "text-green-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {event.change > 0 ? "+" : ""}
                        {event.change}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">
                          {event.source}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="rounded-lg bg-muted/60 p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium">How Thrive Validation Works:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Enable validation mode - LastCallIQ enters read-only mode
              (no writes to Clover)
            </li>
            <li>
              Both Thrive and LastCallIQ receive the same data from Clover
              via webhooks
            </li>
            <li>
              Compare the inventory snapshot and event logs with what Thrive
              shows
            </li>
            <li>
              Once satisfied that LastCallIQ captures everything, end validation
              and proceed with migration
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
