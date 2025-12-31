"use client";

import { useState } from "react";
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
import { X } from "lucide-react";

interface BulkEditModalProps {
  invoice: string;
  itemCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkEditModal({
  invoice,
  itemCount,
  onClose,
  onSuccess,
}: BulkEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    new_invoice: invoice,
    expiration_date: "",
    adjust_quantity: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates: Record<string, string> = {};

      if (formData.new_invoice && formData.new_invoice !== invoice) {
        updates.invoice = formData.new_invoice;
      }

      if (formData.expiration_date) {
        updates.expiration_date = formData.expiration_date;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("inventory_items")
          .update(updates)
          .eq("invoice", invoice);

        if (error) throw error;
      }

      // Handle quantity adjustment separately if provided
      if (formData.adjust_quantity) {
        const adjustment = parseInt(formData.adjust_quantity);
        if (adjustment !== 0) {
          // Get all items with this invoice
          const { data: items, error: fetchError } = await supabase
            .from("inventory_items")
            .select("id, quantity")
            .eq("invoice", formData.new_invoice || invoice);

          if (fetchError) throw fetchError;

          // Update each item's quantity
          for (const item of items || []) {
            const newQuantity = Math.max(0, item.quantity + adjustment);
            const { error: updateError } = await supabase
              .from("inventory_items")
              .update({ quantity: newQuantity })
              .eq("id", item.id);

            if (updateError) throw updateError;
          }
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error occurred";
      console.error("Error bulk updating items:", error);
      alert("Failed to update items: " + message);
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
              <CardTitle className="text-lg sm:text-xl">Bulk Edit by Invoice</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Editing {itemCount} item(s) from invoice:{" "}
                <strong className="break-all">{invoice}</strong>
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_invoice">Update Invoice Number</Label>
                <Input
                  id="new_invoice"
                  value={formData.new_invoice}
                  onChange={(e) =>
                    setFormData({ ...formData, new_invoice: e.target.value })
                  }
                  placeholder={invoice}
                />
                <p className="text-xs text-muted-foreground">
                  Leave as-is or enter new invoice number for all items
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration_date">Update Expiry Date</Label>
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
                <p className="text-xs text-muted-foreground">
                  Set new expiry date for all items in this batch
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjust_quantity">Adjust Quantity</Label>
                <Input
                  id="adjust_quantity"
                  type="number"
                  inputMode="numeric"
                  value={formData.adjust_quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adjust_quantity: e.target.value,
                    })
                  }
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Add or subtract from current quantities (e.g., +50 or -10)
                </p>
              </div>

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
                  {loading ? "Updating..." : `Update ${itemCount} Item(s)`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
