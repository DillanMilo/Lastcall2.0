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

interface AddItemModalProps {
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddItemModal({ orgId, onClose, onSuccess }: AddItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    invoice: "",
    quantity: "",
    reorder_threshold: "",
    expiration_date: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("inventory_items").insert([
        {
          org_id: orgId,
          name: formData.name,
          sku: formData.sku || null,
          invoice: formData.invoice || null,
          quantity: parseInt(formData.quantity) || 0,
          reorder_threshold: parseInt(formData.reorder_threshold) || 0,
          expiration_date: formData.expiration_date || null,
        },
      ]);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error occurred";
      console.error("Error adding item:", error);
      alert("Failed to add item: " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center py-4">
        <Card className="w-full max-w-lg my-auto">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Add New Item</CardTitle>
              <CardDescription>
                Manually add a new inventory item
              </CardDescription>
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
                  placeholder="Angus Biltong Original 100g"
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
                    placeholder="ANG-ORIG-100"
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
                    placeholder="INV-12345"
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
                    placeholder="100"
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
                    placeholder="20"
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

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
