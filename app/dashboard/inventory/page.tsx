"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { InventoryItem, ItemType, OPERATIONAL_CATEGORIES } from "@/types";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  AlertTriangle,
  AlertCircle,
  Edit2,
  Package,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight,
  Boxes,
  ShoppingCart,
  X,
  Clock,
} from "lucide-react";
import { AddItemModal } from "@/components/inventory/AddItemModal";
import { EditItemModal } from "@/components/inventory/EditItemModal";
import { BulkEditModal } from "@/components/inventory/BulkEditModal";
import { InventoryCard } from "@/components/inventory/InventoryCard";
import { MarkOrderedModal } from "@/components/inventory/MarkOrderedModal";
import { MarkReceivedModal } from "@/components/inventory/MarkReceivedModal";

const PAGE_SIZE = 50;

export default function InventoryPage() {
  return (
    <Suspense fallback={<InventoryPageSkeleton />}>
      <InventoryPageContent />
    </Suspense>
  );
}

function InventoryPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 animate-shimmer rounded-lg" />
      <div className="h-12 w-64 animate-shimmer rounded-xl" />
      <Card className="animate-fade-up">
        <CardHeader className="pb-4">
          <div className="h-10 animate-shimmer rounded-lg" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg animate-shimmer"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [activeTab, setActiveTab] = useState<ItemType>("stock");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showPendingOrders, setShowPendingOrders] = useState(false);
  const [markOrderedItems, setMarkOrderedItems] = useState<InventoryItem | InventoryItem[] | null>(null);
  const [markReceivedItem, setMarkReceivedItem] = useState<InventoryItem | null>(null);

  // Initialize low stock filter from URL params
  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "lowStock") {
      setShowLowStockOnly(true);
    }
  }, [searchParams]);

  const fetchInventory = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("inventory_items")
        .select("*", { count: "exact" })
        .eq("org_id", orgId)
        .eq("item_type", activeTab);

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
  }, [orgId, currentPage, debouncedSearch, activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(0);
    setSearchQuery("");
    setDebouncedSearch("");
  }, [activeTab]);

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

  useEffect(() => {
    if (orgId && !authLoading && user) {
      fetchInventory();
    }
  }, [orgId, authLoading, user, fetchInventory]);

  // Auto-refresh when AI assistant modifies inventory
  useEffect(() => {
    const handleInventoryUpdate = () => {
      fetchInventory();
    };
    window.addEventListener('inventory-updated', handleInventoryUpdate);
    return () => window.removeEventListener('inventory-updated', handleInventoryUpdate);
  }, [fetchInventory]);

  // Low stock items exclude items that are already ordered
  const lowStockItems = items.filter(
    (item) => item.quantity <= item.reorder_threshold && item.order_status !== 'ordered'
  );

  // Pending order items
  const pendingItems = items.filter(
    (item) => item.order_status === 'ordered'
  );

  // Filter items based on view toggle
  const displayedItems = showPendingOrders
    ? pendingItems
    : showLowStockOnly
      ? lowStockItems
      : items;

  const clearLowStockFilter = () => {
    setShowLowStockOnly(false);
    setShowPendingOrders(false);
    // Update URL without the filter param
    router.replace("/dashboard/inventory");
  };

  const showPendingOrdersView = () => {
    setShowPendingOrders(true);
    setShowLowStockOnly(false);
  };

  const showLowStockView = () => {
    setShowLowStockOnly(true);
    setShowPendingOrders(false);
  };

  const invoiceCounts = items.reduce((acc, item) => {
    if (item.invoice) {
      acc[item.invoice] = (acc[item.invoice] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNextPage = currentPage < totalPages - 1;
  const hasPrevPage = currentPage > 0;
  const startItem = currentPage * PAGE_SIZE + 1;
  const endItem = Math.min((currentPage + 1) * PAGE_SIZE, totalCount);

  const isLoading = authLoading || loading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-up"
        style={{ animationDelay: '0ms' }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount > 0 ? `${totalCount.toLocaleString()} ${activeTab === 'stock' ? 'stock' : 'operational'} items` : `Manage your ${activeTab === 'stock' ? 'stock' : 'operational items'}`}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add {activeTab === 'stock' ? 'Stock' : 'Operational'} Item
        </Button>
      </div>

      {/* Inventory Type Tabs */}
      <div
        className="flex flex-wrap gap-2 p-1 bg-muted rounded-xl w-fit animate-fade-up"
        style={{ animationDelay: '50ms' }}
      >
        <Button
          variant={activeTab === "stock" && !showPendingOrders ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setActiveTab("stock");
            setShowPendingOrders(false);
            setShowLowStockOnly(false);
          }}
          className="gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          Stock Items
        </Button>
        <Button
          variant={activeTab === "operational" && !showPendingOrders ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setActiveTab("operational");
            setShowPendingOrders(false);
            setShowLowStockOnly(false);
          }}
          className="gap-2"
        >
          <Boxes className="h-4 w-4" />
          Operational
        </Button>
        <Button
          variant={showPendingOrders ? "default" : "ghost"}
          size="sm"
          onClick={showPendingOrdersView}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Pending Orders
          {pendingItems.length > 0 && (
            <Badge variant="secondary" size="sm" className="ml-1 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {pendingItems.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Pending Orders View Active */}
      {showPendingOrders && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-fade-up"
          style={{ animationDelay: '150ms' }}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-blue-600 dark:text-blue-400">
              Pending Orders
            </p>
            <p className="text-sm text-muted-foreground">
              {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} awaiting delivery
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearLowStockFilter}
            className="shrink-0"
          >
            <X className="h-4 w-4 mr-1" />
            Back to All
          </Button>
        </div>
      )}

      {/* Low Stock Filter Active */}
      {showLowStockOnly && !showPendingOrders && (
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 animate-fade-up"
          style={{ animationDelay: '150ms' }}
        >
          <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/20 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5 text-[hsl(var(--warning))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[hsl(var(--warning))]">
              Showing Low Stock Items Only
            </p>
            <p className="text-sm text-muted-foreground">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder threshold
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {lowStockItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMarkOrderedItems(lowStockItems)}
                className="flex-1 sm:flex-none text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950/50"
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Mark All as Ordered
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={clearLowStockFilter}
              className="shrink-0"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filter
            </Button>
          </div>
        </div>
      )}

      {/* Low Stock Alert (when not filtering) */}
      {!showLowStockOnly && !showPendingOrders && lowStockItems.length > 0 && (
        <button
          onClick={showLowStockView}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 animate-fade-up hover:bg-[hsl(var(--warning))]/15 transition-colors text-left"
          style={{ animationDelay: '150ms' }}
        >
          <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[hsl(var(--warning))]">
              Low Stock Alert
            </p>
            <p className="text-sm text-muted-foreground">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder threshold — click to view
            </p>
          </div>
        </button>
      )}

      {/* Main Card */}
      <Card
        variant="default"
        className="animate-fade-up"
        style={{ animationDelay: '250ms' }}
      >
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <Input
                id="search"
                placeholder="Search name, SKU, invoice..."
                icon={<Search className="h-4 w-4" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View Toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="flex-1 sm:flex-none h-8"
              >
                <List className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Table</span>
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="flex-1 sm:flex-none h-8"
              >
                <Grid3x3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cards</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg animate-shimmer"
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                {showPendingOrders ? (
                  <Clock className="w-8 h-8 text-muted-foreground" />
                ) : activeTab === 'stock' ? (
                  <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                ) : (
                  <Boxes className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <p className="text-lg font-medium mb-1">
                {debouncedSearch
                  ? "No results found"
                  : showPendingOrders
                    ? "No pending orders"
                    : showLowStockOnly
                      ? "No low stock items"
                      : activeTab === 'stock'
                        ? "No stock items yet"
                        : "No operational items yet"}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {debouncedSearch
                  ? `No items match "${debouncedSearch}"`
                  : showPendingOrders
                    ? "Items marked as ordered will appear here until received"
                    : showLowStockOnly
                      ? "All items are above their reorder threshold"
                      : activeTab === 'stock'
                        ? "Start by importing your inventory or adding stock items manually"
                        : "Add operational items like cleaning supplies, office materials, or tableware"}
              </p>
              {!debouncedSearch && !showPendingOrders && !showLowStockOnly && (
                <div className="flex gap-3 justify-center">
                  {activeTab === 'stock' && (
                    <Button onClick={() => router.push("/dashboard/import")}>
                      Import CSV
                    </Button>
                  )}
                  <Button variant={activeTab === 'stock' ? "outline" : "default"} onClick={() => setShowAddModal(true)}>
                    Add {activeTab === 'stock' ? 'Manually' : 'Operational Item'}
                  </Button>
                </div>
              )}
              {(showPendingOrders || showLowStockOnly) && (
                <Button variant="outline" onClick={clearLowStockFilter}>
                  Back to All Items
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayedItems.map((item, index) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  index={index}
                  onEdit={() => setEditingItem(item)}
                  onBulkEdit={
                    item.invoice && invoiceCounts[item.invoice] > 1
                      ? () => setBulkEditInvoice(item.invoice!)
                      : undefined
                  }
                  invoiceCount={
                    item.invoice ? invoiceCounts[item.invoice] : undefined
                  }
                  showOrderActions={showLowStockOnly || showPendingOrders}
                  onMarkOrdered={() => setMarkOrderedItems(item)}
                  onMarkReceived={() => setMarkReceivedItem(item)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-5 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Reorder</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedItems.map((item, index) => (
                      <TableRow
                        key={item.id}
                        className="animate-fade-up opacity-0"
                        style={{ animationDelay: `${300 + index * 30}ms`, animationFillMode: 'forwards' }}
                      >
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.sku || "-"}
                        </TableCell>
                        <TableCell>
                          {item.invoice ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="default" size="sm">
                                {item.invoice}
                              </Badge>
                              {invoiceCounts[item.invoice] > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setBulkEditInvoice(item.invoice!)}
                                  className="h-6 px-2 text-xs"
                                >
                                  <Package className="h-3 w-3 mr-1" />
                                  Batch
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              item.quantity <= item.reorder_threshold
                                ? "text-[hsl(var(--warning))] font-semibold data-value"
                                : "data-value"
                            }
                          >
                            {item.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="data-value text-muted-foreground">
                          {item.reorder_threshold}
                        </TableCell>
                        <TableCell>
                          {item.expiration_date
                            ? new Date(item.expiration_date).toLocaleDateString()
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {item.item_type === 'operational' && item.operational_category ? (
                            <Badge variant="muted" size="sm">
                              {OPERATIONAL_CATEGORIES.find(c => c.value === item.operational_category)?.label || item.operational_category}
                            </Badge>
                          ) : item.category ? (
                            <Badge variant="muted" size="sm">
                              {item.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Show order status badge */}
                            {item.order_status === 'ordered' && (
                              <Badge variant="outline" size="sm" className="text-blue-600 border-blue-300 dark:border-blue-700 dark:text-blue-400 mr-2">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {/* Order action buttons when in low stock or pending view */}
                            {(showLowStockOnly || showPendingOrders) && (
                              <>
                                {item.quantity <= item.reorder_threshold && item.order_status !== 'ordered' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setMarkOrderedItems(item)}
                                    className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                                  >
                                    <ShoppingCart className="h-4 w-4" />
                                  </Button>
                                )}
                                {item.order_status === 'ordered' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setMarkReceivedItem(item)}
                                    className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/50"
                                  >
                                    <Package className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditingItem(item)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-6 border-t">
              <p className="text-sm text-muted-foreground order-2 sm:order-1">
                Showing <span className="font-medium data-value">{startItem}</span>-
                <span className="font-medium data-value">{endItem}</span> of{" "}
                <span className="font-medium data-value">{totalCount.toLocaleString()}</span>
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={!hasPrevPage || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <div className="px-3 py-1 rounded-md bg-muted text-sm">
                  <span className="data-value">{currentPage + 1}</span>
                  <span className="text-muted-foreground"> / {totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!hasNextPage || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {showAddModal && orgId && (
        <AddItemModal
          orgId={orgId}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchInventory}
          itemType={activeTab}
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

      {markOrderedItems && (
        <MarkOrderedModal
          items={markOrderedItems}
          onClose={() => setMarkOrderedItems(null)}
          onSuccess={fetchInventory}
        />
      )}

      {markReceivedItem && (
        <MarkReceivedModal
          item={markReceivedItem}
          onClose={() => setMarkReceivedItem(null)}
          onSuccess={fetchInventory}
        />
      )}
    </div>
  );
}
