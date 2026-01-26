"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { InventoryItem } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { X, ShoppingCart } from "lucide-react";

interface MarkOrderedModalProps {
  items: InventoryItem | InventoryItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkOrderedModal({
  items,
  onClose,
  onSuccess,
}: MarkOrderedModalProps) {
  const [loading, setLoading] = useState(false);
  const itemsArray = Array.isArray(items) ? items : [items];
  const itemCount = itemsArray.length;
  const isBulk = itemCount > 1;

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const itemIds = itemsArray.map((item) => item.id);

      const { error } = await supabase
        .from("inventory_items")
        .update({ order_status: "ordered" })
        .in("id", itemIds);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error occurred";
      console.error("Error marking items as ordered:", error);
      alert("Failed to mark as ordered: " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Mark as Ordered</CardTitle>
              <CardDescription className="text-sm">
                {isBulk
                  ? `${itemCount} items will be marked as ordered`
                  : "Confirm order placement"}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="space-y-4">
            {isBulk ? (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Items to be marked as ordered:
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {itemsArray.map((item) => (
                    <li key={item.id} className="text-sm font-medium">
                      {item.name}
                      <span className="text-muted-foreground ml-2">
                        (Qty: {item.quantity})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{itemsArray[0].name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Current quantity: {itemsArray[0].quantity}
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {isBulk
                ? "These items will appear in the Pending Orders tab until marked as received."
                : "This item will appear in the Pending Orders tab until marked as received."}
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full sm:flex-1"
              >
                {loading
                  ? "Marking..."
                  : isBulk
                  ? `Mark ${itemCount} Items as Ordered`
                  : "Mark as Ordered"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
