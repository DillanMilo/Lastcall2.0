"use client";

import { InventoryItem } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Package } from "lucide-react";

interface InventoryCardProps {
  item: InventoryItem;
  onEdit: () => void;
  onBulkEdit?: () => void;
  invoiceCount?: number;
}

export function InventoryCard({
  item,
  onEdit,
  onBulkEdit,
  invoiceCount,
}: InventoryCardProps) {
  const isLowStock = item.quantity <= item.reorder_threshold;

  return (
    <Card className={isLowStock ? "border-amber-300" : ""}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-base">{item.name}</h3>
              {item.sku && (
                <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Invoice */}
          {item.invoice && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {item.invoice}
              </span>
              {invoiceCount && invoiceCount > 1 && onBulkEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkEdit}
                  className="h-6 text-xs"
                >
                  <Package className="h-3 w-3 mr-1" />
                  Edit Batch ({invoiceCount})
                </Button>
              )}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Quantity</p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  isLowStock ? "text-amber-600" : ""
                )}
              >
                {item.quantity}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reorder Point</p>
              <p className="text-lg font-semibold">{item.reorder_threshold}</p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-1 pt-2 border-t">
            {item.expiration_date && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expiry:</span>
                <span className="font-medium">
                  {new Date(item.expiration_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {item.category && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Category:</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                  {item.category}
                </span>
              </div>
            )}
          </div>

          {isLowStock && (
            <div className="text-xs text-amber-600 font-medium">
              ⚠️ Below reorder point
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Import cn utility
import { cn } from "@/lib/utils/cn";
