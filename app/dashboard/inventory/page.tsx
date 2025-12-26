"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { InventoryItem } from "@/types";
import { useAuth } from "@/lib/auth/useAuth";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AddItemModal } from "@/components/inventory/AddItemModal";
import { EditItemModal } from "@/components/inventory/EditItemModal";
import { BulkEditModal } from "@/components/inventory/BulkEditModal";
import { InventoryCard } from "@/components/inventory/InventoryCard";

const PAGE_SIZE = 50;

export default function InventoryPage() {
  const router = useRouter();
  const { user, orgId, loading: authLoading } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [bulkEditInvoice, setBulkEditInvoice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchInventory = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("inventory_items")
        .select("*", { count: "exact" })
        .eq("org_id", orgId);

      // Server-side search
      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,invoice.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        if (
          error.message?.includes("Failed to fetch") ||
          error.message?.includes("FetchError") ||
          error.message?.includes("fetch failed")
        ) {
          setItems([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        throw error;
      }

      setItems(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch inventory";
      console.error("Error fetching inventory:", message);
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [orgId, currentPage, debouncedSearch]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(0); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auth check and resize handling
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    const handleResize = () => {
      if (window.innerWidth < 768 && viewMode === "table") {
        setViewMode("grid");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [authLoading, user, router, viewMode]);

  // Fetch inventory when dependencies change
  useEffect(() => {
    if (orgId && !authLoading && user) {
      fetchInventory();
    }
  }, [orgId, authLoading, user, fetchInventory]);

  // Items are already filtered server-side, use directly
  const lowStockItems = items.filter(
    (item) => item.quantity <= item.reorder_threshold
  );

  // Group items by invoice for bulk edit
  const invoiceCounts = items.reduce((acc, item) => {
    if (item.invoice) {
      acc[item.invoice] = (acc[item.invoice] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNextPage = currentPage < totalPages - 1;
  const hasPrevPage = currentPage > 0;
  const startItem = currentPage * PAGE_SIZE + 1;
  const endItem = Math.min((currentPage + 1) * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
            Inventory
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            Manage stock and track batches
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          size="sm"
          className="w-full sm:w-auto sm:h-10"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Item</span>
          <span className="sm:hidden">Add</span>
        </Button>
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
          {authLoading || loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {authLoading ? "Authenticating..." : "Loading inventory..."}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {debouncedSearch
                  ? `No items match "${debouncedSearch}"`
                  : "No items found. Start by importing your inventory!"}
              </p>
              {!debouncedSearch && (
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
              )}
            </div>
          ) : viewMode === "grid" ? (
            // Card View (Mobile-friendly)
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
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
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
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
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
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
                            ? new Date(
                                item.expiration_date
                              ).toLocaleDateString()
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
            </div>
          )}

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground order-2 sm:order-1">
                Showing {startItem}-{endItem} of {totalCount.toLocaleString()} items
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={!hasPrevPage || loading}
                  className="h-9"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!hasNextPage || loading}
                  className="h-9"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showAddModal && orgId && (
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
    </div>
  );
}
