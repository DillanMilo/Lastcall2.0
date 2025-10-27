"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { InventoryItem } from "@/types";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  AlertCircle,
  Edit2,
  Package,
  Grid3x3,
  List,
  Sparkles,
} from "lucide-react";
import { AddItemModal } from "@/components/inventory/AddItemModal";
import { EditItemModal } from "@/components/inventory/EditItemModal";
import { BulkEditModal } from "@/components/inventory/BulkEditModal";
import { InventoryCard } from "@/components/inventory/InventoryCard";
import { AIAssistant } from "@/components/inventory/AIAssistant";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [bulkEditInvoice, setBulkEditInvoice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const orgId = "00000000-0000-0000-0000-000000000001";

  useEffect(() => {
    fetchInventory();
    // Auto-set to card view on mobile
    const handleResize = () => {
      if (window.innerWidth < 768 && viewMode === "table") {
        setViewMode("grid");
      }
    };
    handleResize(); // Check on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (
          error.message?.includes("Failed to fetch") ||
          error.message?.includes("FetchError") ||
          error.message?.includes("fetch failed")
        ) {
          setItems([]);
          setLoading(false);
          return;
        }
        throw error;
      }
      setItems(data || []);
    } catch (error: any) {
      if (
        error.message?.includes("fetch") ||
        error.message?.includes("network") ||
        error.code === "PGRST"
      ) {
        setItems([]);
      } else {
        console.error("Error fetching inventory:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.invoice?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = filteredItems.filter(
    (item) => item.quantity <= item.reorder_threshold
  );

  // Group items by invoice for bulk edit
  const invoiceCounts = filteredItems.reduce((acc, item) => {
    if (item.invoice) {
      acc[item.invoice] = (acc[item.invoice] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Inventory
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage stock and track batches
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAIAssistant(true)}
            size="sm"
            variant="outline"
            className="md:h-10"
          >
            <Sparkles className="h-4 w-4 md:mr-2" />
            <span className="hidden sm:inline">AI Assistant</span>
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="md:h-10"
          >
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden sm:inline">Add Item</span>
          </Button>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <AlertCircle className="h-5 w-5" />
              Low Stock Alert
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              {lowStockItems.length} item(s) below reorder threshold
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search name, SKU, invoice..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="flex-1 sm:flex-none"
              >
                <List className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Table</span>
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="flex-1 sm:flex-none"
              >
                <Grid3x3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cards</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading inventory...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No items found. Start by importing your inventory!
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => (window.location.href = "/dashboard/import")}
                >
                  Import CSV
                </Button>
                <Button variant="outline" onClick={() => setShowAddModal(true)}>
                  Add Manually
                </Button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            // Card View (Mobile-friendly)
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  onEdit={() => setEditingItem(item)}
                  onBulkEdit={
                    item.invoice && invoiceCounts[item.invoice] > 1
                      ? () => setBulkEditInvoice(item.invoice!)
                      : undefined
                  }
                  invoiceCount={
                    item.invoice ? invoiceCounts[item.invoice] : undefined
                  }
                />
              ))}
            </div>
          ) : (
            // Table View (Desktop)
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reorder Point</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku || "-"}</TableCell>
                      <TableCell>
                        {item.invoice ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {item.invoice}
                            </span>
                            {invoiceCounts[item.invoice] > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setBulkEditInvoice(item.invoice!)
                                }
                                className="h-6 px-2 text-xs"
                              >
                                <Package className="h-3 w-3 mr-1" />
                                Edit Batch ({invoiceCounts[item.invoice]})
                              </Button>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            item.quantity <= item.reorder_threshold
                              ? "text-amber-600 font-semibold"
                              : ""
                          }
                        >
                          {item.quantity}
                        </span>
                      </TableCell>
                      <TableCell>{item.reorder_threshold}</TableCell>
                      <TableCell>
                        {item.expiration_date
                          ? new Date(item.expiration_date).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {item.category ? (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                            {item.category}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showAddModal && (
        <AddItemModal
          orgId={orgId}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchInventory}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={fetchInventory}
        />
      )}

      {bulkEditInvoice && (
        <BulkEditModal
          invoice={bulkEditInvoice}
          itemCount={invoiceCounts[bulkEditInvoice]}
          onClose={() => setBulkEditInvoice(null)}
          onSuccess={fetchInventory}
        />
      )}

      {showAIAssistant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl">
            <AIAssistant
              orgId={orgId}
              onClose={() => setShowAIAssistant(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
