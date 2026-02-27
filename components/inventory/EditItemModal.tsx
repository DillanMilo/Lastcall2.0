"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { InventoryItem, OperationalCategory, OPERATIONAL_CATEGORIES } from "@/types";
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
import { X, Trash2, Package, Boxes, Upload, Check, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface EditItemModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditItemModal({
  item,
  onClose,
  onSuccess,
}: EditItemModalProps) {
  const isOperational = item.item_type === 'operational';
  const [loading, setLoading] = useState(false);
  const [bigCommerceConnected, setBigCommerceConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [operationalCategory, setOperationalCategory] = useState<OperationalCategory | "">(
    item.operational_category || ""
  );
  const [formData, setFormData] = useState({
    name: item.name,
    sku: item.sku || "",
    invoice: item.invoice || "",
    quantity: item.quantity.toString(),
    reorder_threshold: item.reorder_threshold.toString(),
    expiration_date: item.expiration_date || "",
  });

  const hasBigCommerceProduct = !!item.bigcommerce_product_id;
  const hasCloverLink = !!(item.clover_item_id || item.clover_merchant_id);
  const [pushingToClover, setPushingToClover] = useState(false);
  const [cloverPushStatus, setCloverPushStatus] = useState<"idle" | "success" | "error">("idle");
  const [cloverPushMessage, setCloverPushMessage] = useState("");

  // Check if BigCommerce is connected
  useEffect(() => {
    if (isOperational || !hasBigCommerceProduct) return;

    const checkConnection = async () => {
      try {
        const { data: org } = await supabase
          .from("organizations")
          .select("bigcommerce_store_hash")
          .eq("id", item.org_id)
          .single();

        if (org?.bigcommerce_store_hash) {
          setBigCommerceConnected(true);
        }
      } catch (error) {
        console.error("Error checking BigCommerce connection:", error);
      }
    };

    checkConnection();
  }, [item.org_id, isOperational, hasBigCommerceProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSyncStatus("idle");
    setSyncMessage("");

    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({
          name: formData.name,
          sku: formData.sku || null,
          invoice: formData.invoice || null,
          quantity: parseInt(formData.quantity) || 0,
          reorder_threshold: parseInt(formData.reorder_threshold) || 0,
          expiration_date: formData.expiration_date || null,
          operational_category: isOperational && operationalCategory ? operationalCategory : null,
        })
        .eq("id", item.id);

      if (error) throw error;

      // Sync to BigCommerce if this item is linked to a BC product
      if (!isOperational && bigCommerceConnected && hasBigCommerceProduct) {
        setSyncStatus("syncing");
        try {
          const response = await fetch("/api/integrations/bigcommerce/create-product", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              org_id: item.org_id,
              name: formData.name,
              sku: formData.sku || undefined,
              quantity: parseInt(formData.quantity) || 0,
              bigcommerce_product_id: parseInt(item.bigcommerce_product_id!),
              action: 'set',
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to sync to BigCommerce");
          }

          setSyncStatus("success");
          setSyncMessage(data.message || "Synced to BigCommerce!");

          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
          return;
        } catch (syncError) {
          const syncMsg = syncError instanceof Error ? syncError.message : "Sync failed";
          console.error("BigCommerce sync error:", syncError);
          setSyncStatus("error");
          setSyncMessage(`Saved locally, but BigCommerce sync failed: ${syncMsg}`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 3000);
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error occurred";
      console.error("Error updating item:", error);
      alert("Failed to update item: " + message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${item.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error occurred";
      console.error("Error deleting item:", error);
      alert("Failed to delete item: " + message);
    } finally {
      setLoading(false);
    }
  };

  const handlePushToClover = async () => {
    setPushingToClover(true);
    setCloverPushStatus("idle");
    setCloverPushMessage("");

    try {
      const response = await fetch("/api/integrations/clover/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ item_id: item.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Push failed");

      setCloverPushStatus("success");
      setCloverPushMessage(data.message || "Pushed to Clover!");
      setTimeout(() => {
        setCloverPushStatus("idle");
        setCloverPushMessage("");
      }, 4000);
    } catch (err) {
      setCloverPushStatus("error");
      setCloverPushMessage(err instanceof Error ? err.message : "Push failed");
      setTimeout(() => {
        setCloverPushStatus("idle");
        setCloverPushMessage("");
      }, 5000);
    } finally {
      setPushingToClover(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto overscroll-contain">
      <div className="min-h-full sm:min-h-0 w-full sm:w-auto flex items-center justify-center py-4 sm:py-8">
        <Card className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:my-auto sm:rounded-lg overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6 sticky top-0 bg-card border-b z-10">
            <div className="min-w-0 flex-1 pr-2 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isOperational ? 'bg-purple-100 dark:bg-purple-950/50' : 'bg-primary/10'}`}>
                {isOperational ? (
                  <Boxes className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Package className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  Edit {isOperational ? 'Operational' : 'Stock'} Item
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {isOperational ? 'Update operational item details' : 'Update inventory item details'}
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {isOperational ? 'Item Name' : 'Product Name'} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              {/* Operational Category - only for operational items */}
              {isOperational && (
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={operationalCategory}
                    onChange={(e) => setOperationalCategory(e.target.value as OperationalCategory | "")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select a category...</option>
                    {OPERATIONAL_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice">Invoice/Batch #</Label>
                  <Input
                    id="invoice"
                    value={formData.invoice}
                    onChange={(e) =>
                      setFormData({ ...formData, invoice: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    inputMode="numeric"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorder_threshold">Reorder Point</Label>
                  <Input
                    id="reorder_threshold"
                    type="number"
                    inputMode="numeric"
                    value={formData.reorder_threshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reorder_threshold: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration_date">Expiry Date</Label>
                <Input
                  id="expiration_date"
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expiration_date: e.target.value,
                    })
                  }
                />
              </div>

              {/* BigCommerce Sync Indicator */}
              {!isOperational && bigCommerceConnected && hasBigCommerceProduct && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Linked to BigCommerce</p>
                      <p className="text-xs text-muted-foreground">
                        Changes will automatically sync to BigCommerce
                      </p>
                    </div>
                  </div>

                  {/* Sync Status Message */}
                  {syncStatus !== "idle" && (
                    <div className={`mt-3 flex items-center gap-2 text-sm ${
                      syncStatus === "success" ? "text-green-600" :
                      syncStatus === "error" ? "text-destructive" :
                      "text-muted-foreground"
                    }`}>
                      {syncStatus === "syncing" && (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          <span>Syncing to BigCommerce...</span>
                        </>
                      )}
                      {syncStatus === "success" && (
                        <>
                          <Check className="h-4 w-4" />
                          <span>{syncMessage}</span>
                        </>
                      )}
                      {syncStatus === "error" && (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          <span>{syncMessage}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Clover Push Indicator */}
              {hasCloverLink && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Linked to Clover</p>
                        <p className="text-xs text-muted-foreground">
                          Push this item&apos;s count to Clover POS
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePushToClover}
                      disabled={loading || pushingToClover}
                      className={cn(
                        cloverPushStatus === "success" && "text-green-600 border-green-300",
                        cloverPushStatus === "error" && "text-destructive border-destructive/30"
                      )}
                    >
                      {pushingToClover ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Pushing...
                        </>
                      ) : cloverPushStatus === "success" ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Pushed!
                        </>
                      ) : cloverPushStatus === "error" ? (
                        <>
                          <AlertCircle className="mr-2 h-4 w-4" />
                          Failed
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Push to Clover
                        </>
                      )}
                    </Button>
                  </div>
                  {cloverPushMessage && (
                    <p className={cn(
                      "mt-2 text-xs",
                      cloverPushStatus === "success" ? "text-green-600" : "text-destructive"
                    )}>
                      {cloverPushMessage}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
