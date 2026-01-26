"use client";

import { useState } from "react";
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
import { X, PackageCheck } from "lucide-react";

interface MarkReceivedModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkReceivedModal({
  item,
  onClose,
  onSuccess,
}: MarkReceivedModalProps) {
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(item.reorder_threshold.toString());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newQuantity = parseInt(quantity) || 0;

      const { error } = await supabase
        .from("inventory_items")
        .update({
          order_status: null,
          quantity: newQuantity,
          last_restock: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error occurred";
      console.error("Error marking item as received:", error);
      alert("Failed to mark as received: " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
              <PackageCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Mark as Received</CardTitle>
              <CardDescription className="text-sm">
                Update stock quantity for received order
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Current quantity: {item.quantity}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">New Quantity After Restock</Label>
              <Input
                id="quantity"
                type="number"
                inputMode="numeric"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter received quantity"
              />
              <p className="text-xs text-muted-foreground">
                Enter the total stock quantity after receiving this order
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:flex-1"
              >
                {loading ? "Updating..." : "Mark as Received"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
