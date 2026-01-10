"use client";

import { InventoryItem } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Package, Calendar, Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface InventoryCardProps {
  item: InventoryItem;
  onEdit: () => void;
  onBulkEdit?: () => void;
  invoiceCount?: number;
  index?: number;
}

export function InventoryCard({
  item,
  onEdit,
  onBulkEdit,
  invoiceCount,
  index = 0,
}: InventoryCardProps) {
  const isLowStock = item.quantity <= item.reorder_threshold;

  return (
    <Card
      variant="default"
      hover
      className={cn(
        "animate-fade-up opacity-0 overflow-hidden",
        isLowStock && "ring-1 ring-[hsl(var(--warning))]/30"
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
    >
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base line-clamp-2">{item.name}</h3>
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
            {item.category && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  Category
                </span>
                <Badge variant="muted" size="sm">
                  {item.category}
                </Badge>
              </div>
            )}
          </div>

          {/* Low Stock Warning */}
          {isLowStock && (
            <Badge variant="warning" className="w-full justify-center py-1.5">
              Below reorder point
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
