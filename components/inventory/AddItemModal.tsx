"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
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
import { X, Upload, Check, AlertCircle, Search, Package } from "lucide-react";

interface BigCommerceProduct {
  id: number;
  name: string;
  sku: string;
  inventory_level: number;
}

interface AddItemModalProps {
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddItemModal({ orgId, onClose, onSuccess }: AddItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncToBigCommerce, setSyncToBigCommerce] = useState(false);
  const [bigCommerceConnected, setBigCommerceConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    invoice: "",
    quantity: "",
    reorder_threshold: "",
    expiration_date: "",
  });

  // Autocomplete state
  const [searchResults, setSearchResults] = useState<BigCommerceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<BigCommerceProduct | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if BigCommerce is connected
  useEffect(() => {
    const checkBigCommerceConnection = async () => {
      try {
        const { data: org } = await supabase
          .from("organizations")
          .select("bigcommerce_store_hash")
          .eq("id", orgId)
          .single();

        if (org?.bigcommerce_store_hash) {
          setBigCommerceConnected(true);
        }
      } catch (error) {
        console.error("Error checking BigCommerce connection:", error);
      }
    };

    checkBigCommerceConnection();
  }, [orgId]);

  // Debounced search for BigCommerce products
  const searchProducts = useCallback(async (query: string) => {
    if (!bigCommerceConnected || query.length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `/api/integrations/bigcommerce/search-products?org_id=${orgId}&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setSearchResults(data.products || []);
      setShowSuggestions(data.products?.length > 0);
    } catch (error) {
      console.error("Error searching products:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [orgId, bigCommerceConnected]);

  // Handle name input change with debounced search
  const handleNameChange = (value: string) => {
    setFormData({ ...formData, name: value });

    // Clear selected product if user changes name
    if (selectedProduct && value !== selectedProduct.name) {
      setSelectedProduct(null);
    }

    // Debounce the search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (bigCommerceConnected && value.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchProducts(value);
      }, 300);
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  // Handle product selection from autocomplete
  const handleSelectProduct = (product: BigCommerceProduct) => {
    setSelectedProduct(product);
    setFormData({ ...formData, name: product.name });
    setShowSuggestions(false);
    setSearchResults([]);
    // Auto-enable sync when a BigCommerce product is selected
    setSyncToBigCommerce(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSyncStatus("idle");
    setSyncMessage("");

    try {
      // First, add to local database
      const { error } = await supabase.from("inventory_items").insert([
        {
          org_id: orgId,
          name: formData.name,
          sku: formData.sku || null,
          invoice: formData.invoice || null,
          quantity: parseInt(formData.quantity) || 0,
          reorder_threshold: parseInt(formData.reorder_threshold) || 0,
          expiration_date: formData.expiration_date || null,
        },
      ]);

      if (error) throw error;

      // If sync to BigCommerce is enabled, push to BigCommerce
      if (syncToBigCommerce && bigCommerceConnected) {
        setSyncStatus("syncing");
        try {
          const response = await fetch("/api/integrations/bigcommerce/create-product", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              org_id: orgId,
              name: formData.name,
              sku: formData.sku || undefined,
              quantity: parseInt(formData.quantity) || 0,
              invoice: formData.invoice || undefined,
              expiration_date: formData.expiration_date || undefined,
              // If a product was selected from autocomplete, use its BigCommerce ID
              bigcommerce_product_id: selectedProduct?.id,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to sync to BigCommerce");
          }

          setSyncStatus("success");
          setSyncMessage(data.message || "Synced to BigCommerce!");

          // Wait a moment to show success, then close
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
          return;
        } catch (syncError) {
          const syncMsg = syncError instanceof Error ? syncError.message : "Sync failed";
          console.error("BigCommerce sync error:", syncError);
          setSyncStatus("error");
          setSyncMessage(`Item saved locally, but BigCommerce sync failed: ${syncMsg}`);
          // Still close after showing error briefly
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
      console.error("Error adding item:", error);
      alert("Failed to add item: " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto overscroll-contain">
      <div className="min-h-full sm:min-h-0 w-full sm:w-auto flex items-center justify-center py-4 sm:py-8">
        <Card className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:my-auto sm:rounded-lg overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6 sticky top-0 bg-card border-b z-10">
            <div className="min-w-0 flex-1 pr-2">
              <CardTitle className="text-lg sm:text-xl">Add New Item</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Manually add a new inventory item
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowSuggestions(true);
                      }}
                      onBlur={() => {
                        // Delay hiding to allow click on suggestion
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      placeholder={bigCommerceConnected ? "Start typing to search BigCommerce..." : "Angus Biltong Original 100g"}
                      className={selectedProduct ? "pr-10 border-green-500 bg-green-50 dark:bg-green-950/20" : ""}
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    )}
                    {selectedProduct && !searching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                  </div>

                  {/* Autocomplete dropdown */}
                  {showSuggestions && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 text-xs text-muted-foreground border-b">
                        <Search className="h-3 w-3 inline mr-1" />
                        Select a product from BigCommerce
                      </div>
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleSelectProduct(product)}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-3"
                        >
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.sku && `SKU: ${product.sku} • `}
                              Stock: {product.inventory_level}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected product indicator */}
                  {selectedProduct && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Linked to BigCommerce product (ID: {selectedProduct.id})
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    placeholder="ANG-ORIG-100"
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
                    placeholder="INV-12345"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    placeholder="100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorder_threshold">Reorder Point</Label>
                  <Input
                    id="reorder_threshold"
                    type="number"
                    value={formData.reorder_threshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reorder_threshold: e.target.value,
                      })
                    }
                    placeholder="20"
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

              {/* BigCommerce Sync Toggle */}
              {bigCommerceConnected && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor="sync-toggle" className="font-medium cursor-pointer">
                          Sync to BigCommerce
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {selectedProduct
                            ? `Add ${formData.quantity || 0} units to existing product`
                            : "Create new product in BigCommerce"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="sync-toggle"
                      role="switch"
                      aria-checked={syncToBigCommerce}
                      onClick={() => setSyncToBigCommerce(!syncToBigCommerce)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        syncToBigCommerce ? "bg-primary" : "bg-input"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform ${
                          syncToBigCommerce ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
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

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4">
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
                  {loading ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
