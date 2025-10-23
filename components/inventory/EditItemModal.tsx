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
import { X, Trash2 } from "lucide-react";

interface EditItemModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditItemModal({
  item,
  onClose,
  onSuccess,
}: EditItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: item.name,
    sku: item.sku || "",
    invoice: item.invoice || "",
    quantity: item.quantity.toString(),
    reorder_threshold: item.reorder_threshold.toString(),
    expiration_date: item.expiration_date || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({
          name: formData.name,
          sku: formData.sku || null,
          invoice: formData.invoice || null,
          quantity: parseInt(formData.quantity) || 0,
          reorder_threshold: parseInt(formData.reorder_threshold) || 0,
          expiration_date: formData.expiration_date || null,
        })
        .eq("id", item.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error updating item:", error);
      alert("Failed to update item: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${item.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Edit Item</CardTitle>
            <CardDescription>Update inventory item details</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice">Invoice/Batch #</Label>
                <Input
                  id="invoice"
                  value={formData.invoice}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorder_threshold">Reorder Point</Label>
                <Input
                  id="reorder_threshold"
                  type="number"
                  value={formData.reorder_threshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reorder_threshold: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration_date">Expiry Date</Label>
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
            </div>

            <div className="flex gap-2 justify-between pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
