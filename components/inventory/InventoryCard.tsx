"use client";

import { InventoryItem, OPERATIONAL_CATEGORIES } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Package, Calendar, Tag, Boxes, ShoppingCart, PackageCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface InventoryCardProps {
  item: InventoryItem;
  onEdit: () => void;
  onBulkEdit?: () => void;
  onMarkOrdered?: () => void;
  onMarkReceived?: () => void;
  invoiceCount?: number;
  index?: number;
  showOrderActions?: boolean;
}

export function InventoryCard({
  item,
  onEdit,
  onBulkEdit,
  onMarkOrdered,
  onMarkReceived,
  invoiceCount,
  index = 0,
  showOrderActions = false,
}: InventoryCardProps) {
  const isLowStock = item.quantity <= item.reorder_threshold;
  const isPendingOrder = item.order_status === 'ordered';
  const isOperational = item.item_type === 'operational';
  const operationalCategoryLabel = item.operational_category
    ? OPERATIONAL_CATEGORIES.find(c => c.value === item.operational_category)?.label
    : null;

  return (
    <Card
      variant="default"
      hover
      className={cn(
        "animate-fade-up opacity-0 overflow-hidden",
        isLowStock && !isPendingOrder && "ring-1 ring-[hsl(var(--warning))]/30",
        isPendingOrder && "ring-1 ring-blue-500/30"
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
    >
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base line-clamp-2">{item.name}</h3>
                {isPendingOrder && (
                  <Badge variant="outline" size="sm" className="shrink-0 text-blue-600 border-blue-300 dark:border-blue-700 dark:text-blue-400">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
                {isOperational && (
                  <Badge variant="outline" size="sm" className="shrink-0 text-purple-600 border-purple-300 dark:border-purple-700 dark:text-purple-400">
                    <Boxes className="h-3 w-3 mr-1" />
                    Ops
                  </Badge>
                )}
              </div>
              {item.sku && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                  SKU: {item.sku}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Invoice Badge */}
          {item.invoice && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" size="sm">
                {item.invoice}
              </Badge>
              {invoiceCount && invoiceCount > 1 && onBulkEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkEdit}
                  className="h-7 text-xs"
                >
                  <Package className="h-3 w-3 mr-1" />
                  Batch ({invoiceCount})
                </Button>
              )}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 py-3 px-3 -mx-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Quantity
              </p>
              <p
                className={cn(
                  "text-2xl font-bold data-value tracking-tight",
                  isLowStock && "text-[hsl(var(--warning))]"
                )}
              >
                {item.quantity}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Reorder At
              </p>
              <p className="text-2xl font-bold data-value tracking-tight">
                {item.reorder_threshold}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-2">
            {item.expiration_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Expires
                </span>
                <span className="font-medium">
                  {new Date(item.expiration_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {(item.category || operationalCategoryLabel) && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  Category
                </span>
                <Badge variant="muted" size="sm">
                  {operationalCategoryLabel || item.category}
                </Badge>
              </div>
            )}
          </div>

          {/* Low Stock Warning */}
          {isLowStock && !isPendingOrder && (
            <Badge variant="warning" className="w-full justify-center py-1.5">
              Below reorder point
            </Badge>
          )}

          {/* Order Action Buttons */}
          {showOrderActions && (
            <div className="pt-2">
              {isLowStock && !isPendingOrder && onMarkOrdered && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMarkOrdered}
                  className="w-full text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950/50"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Mark as Ordered
                </Button>
              )}
              {isPendingOrder && onMarkReceived && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMarkReceived}
                  className="w-full text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/50"
                >
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Mark as Received
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
