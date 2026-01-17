"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Edit2,
  Package,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight,
  Boxes,
  ShoppingCart,
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
  const [activeTab, setActiveTab] = useState<ItemType>("stock");

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

  const lowStockItems = items.filter(
    (item) => item.quantity <= item.reorder_threshold
  );

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
        className="flex gap-2 p-1 bg-muted rounded-xl w-fit animate-fade-up"
        style={{ animationDelay: '50ms' }}
      >
        <Button
          variant={activeTab === "stock" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("stock")}
          className="gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          Stock Items
        </Button>
        <Button
          variant={activeTab === "operational" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("operational")}
          className="gap-2"
        >
          <Boxes className="h-4 w-4" />
          Operational
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 animate-fade-up"
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
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder threshold
            </p>
          </div>
        </div>
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
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                {activeTab === 'stock' ? (
                  <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                ) : (
                  <Boxes className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <p className="text-lg font-medium mb-1">
                {debouncedSearch
                  ? "No results found"
                  : activeTab === 'stock'
                    ? "No stock items yet"
                    : "No operational items yet"}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {debouncedSearch
                  ? `No items match "${debouncedSearch}"`
                  : activeTab === 'stock'
                    ? "Start by importing your inventory or adding stock items manually"
                    : "Add operational items like cleaning supplies, office materials, or tableware"}
              </p>
              {!debouncedSearch && (
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
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((item, index) => (
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
                    {items.map((item, index) => (
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
                          <Button
                            variant="ghost"
                            size="icon-sm"
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
    </div>
  );
}
