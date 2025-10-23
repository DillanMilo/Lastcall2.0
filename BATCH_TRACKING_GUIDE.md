# 📦 Batch/Invoice Tracking Guide

## Overview

LastCall 2.0 now supports full batch tracking using invoice numbers! This allows you to:

- Track the same product across multiple batches with different expiry dates
- Bulk edit all items from a specific invoice
- Easily manage product lots

---

## 🎯 How It Works

### Same Product, Different Batches

You can now have multiple entries of the same product with different invoice numbers and expiry dates:

```
Mixed Nuts 500g | INV-321  | Expires: 2025-12-31 | Qty: 30
Mixed Nuts 500g | INV-654  | Expires: 2026-06-30 | Qty: 45
```

This means:

- ✅ First batch (INV-321) expires sooner
- ✅ Second batch (INV-654) expires later
- ✅ Both are tracked separately
- ✅ Both can be edited individually OR as a batch

---

## 📝 Step 1: Update Database

**Run this in Supabase SQL Editor:**

```sql
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS invoice TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_invoice ON inventory_items(invoice);

COMMENT ON COLUMN inventory_items.invoice IS 'Invoice/batch number for tracking product lots with different expiry dates';
```

---

## 📥 Step 2: Import with Invoice Numbers

### CSV Format

Update your CSV to include the `invoice` column:

```csv
name,sku,invoice,quantity,reorder_threshold,expiration_date
Angus Biltong Original 100g,ANG-ORIG-100,INV-12345,250,50,2026-03-30
Angus Biltong Peri-Peri 100g,ANG-PERI-100,INV-12345,180,40,2026-03-30
Mixed Nuts 500g,SNACK-NUTS-500,INV-321,30,10,2025-12-31
Mixed Nuts 500g,SNACK-NUTS-500,INV-654,45,10,2026-06-30
```

### Import via UI

1. Go to **Dashboard → Import**
2. Upload your CSV with invoice column
3. Click **Import**
4. All items will be tagged with their invoice numbers

---

## ➕ Step 3: Add Items Manually

### Click "Add Item" Button

1. Navigate to **Dashboard → Inventory**
2. Click **"Add Item"** button (top right)
3. Fill in the form:
   - **Product Name\*** (required)
   - **SKU** (optional)
   - **Invoice/Batch #** (optional but recommended!)
   - **Quantity**
   - **Reorder Point**
   - **Expiry Date**
4. Click **"Add Item"**

### Example Use Case

You receive a new shipment:

- Invoice: INV-789
- 3 products in this shipment
- All expire on 2025-05-20

Add each product with invoice "INV-789" - now you can track this entire shipment together!

---

## ✏️ Step 4: Edit Items

### Edit Individual Item

1. Find the item in your inventory table
2. Click the **Edit** button (pencil icon) in the Actions column
3. Update any field:
   - Name, SKU, Invoice
   - Quantity, Reorder Point
   - Expiry Date
4. Click **"Save Changes"**

### Delete Item

- In the edit modal, click **"Delete"** button
- Confirm the deletion
- Item is permanently removed

---

## 📦 Step 5: Bulk Edit by Invoice

### When to Use Bulk Edit

Perfect for:

- Updating expiry dates for entire batch
- Changing invoice numbers
- Adjusting quantities across a shipment
- Managing product recalls

### How to Bulk Edit

1. Go to **Dashboard → Inventory**
2. Find any item with an invoice number
3. If multiple items share that invoice, you'll see:
   ```
   INV-12345 [Edit Batch (3)]
   ```
4. Click **"Edit Batch"**
5. In the modal, you can:
   - **Update Invoice Number** - Change for all items
   - **Update Expiry Date** - Set new date for all items
   - **Adjust Quantity** - Add or subtract from all items (e.g., +50 or -10)
6. Click **"Update X Item(s)"**

### Example Scenarios

**Scenario 1: Product Recall**

```
Invoice: INV-BAD-123 (contaminated batch)
Action: Select all items → Adjust Quantity → Set to 0
```

**Scenario 2: Extended Shelf Life**

```
Invoice: INV-12345
Original Expiry: 2026-03-30
Action: Bulk Edit → Update Expiry Date → 2026-06-30
```

**Scenario 3: Partial Sale**

```
Invoice: INV-789 (2 items sold from each product)
Action: Bulk Edit → Adjust Quantity → -2
```

---

## 🔍 Search by Invoice

The search box now supports invoice numbers:

1. Type invoice number (e.g., "INV-12345")
2. See all items from that batch
3. Edit individual items or bulk edit all

---

## 📊 Inventory Table Columns

Your inventory table now shows:

| Column        | Description                                |
| ------------- | ------------------------------------------ |
| Name          | Product name                               |
| SKU           | Stock keeping unit                         |
| **Invoice**   | Batch/invoice number with bulk edit button |
| Quantity      | Current stock (red if below reorder point) |
| Reorder Point | Minimum quantity before reorder            |
| Expiry        | Expiration date                            |
| Category      | AI-generated category                      |
| Actions       | Edit button                                |

---

## 💡 Best Practices

### Invoice Naming Convention

Use a consistent format:

```
INV-12345    ← Sequential numbers
INV-2025-01  ← Year + month
BATCH-A001   ← Batch codes
PO-789       ← Purchase order numbers
```

### Tracking Expiry Dates

1. **Always add expiry dates** when creating/importing items
2. **Group by invoice** for same-batch products
3. **Use bulk edit** to update expiry if shelf life changes
4. **Monitor dashboard** for expiring items

### Managing Multiple Batches

```
Product: Protein Bars Chocolate
├── INV-001 | Qty: 100 | Expires: 2025-09-15 ← Sell first (FIFO)
├── INV-002 | Qty: 150 | Expires: 2026-01-20
└── INV-003 | Qty: 200 | Expires: 2026-04-30 ← Sell last
```

**Workflow:**

1. Sell from oldest batch (INV-001) first
2. Edit individual items to reduce quantity as sold
3. When INV-001 is empty, delete those entries
4. Move to next batch

---

## 🔄 Example Workflow: New Shipment

### You Receive Invoice INV-SEPT-2025

**Products:**

- 100x Angus Biltong Original 100g (Expires: 2026-03-30)
- 75x Angus Biltong Peri-Peri 100g (Expires: 2026-03-30)
- 50x Beef Jerky Teriyaki (Expires: 2026-03-30)

**Steps:**

1. **Option A: CSV Import**

   ```csv
   name,sku,invoice,quantity,reorder_threshold,expiration_date
   Angus Biltong Original 100g,ANG-ORIG-100,INV-SEPT-2025,100,20,2026-03-30
   Angus Biltong Peri-Peri 100g,ANG-PERI-100,INV-SEPT-2025,75,20,2026-03-30
   Beef Jerky Teriyaki,BJ-TERI-100,INV-SEPT-2025,50,15,2026-03-30
   ```

   Upload via Dashboard → Import

2. **Option B: Manual Entry**

   - Click "Add Item" 3 times
   - Enter INV-SEPT-2025 for all three
   - Set same expiry date

3. **Verify**

   - Search "INV-SEPT-2025"
   - See all 3 items
   - Each has "Edit Batch (3)" button

4. **Later: Bulk Update**
   - If expiry extends: Bulk Edit → New Date
   - If partial sale: Bulk Edit → Adjust -X
   - If quality issue: Bulk Edit → Adjust to 0

---

## 🎓 Advanced: API Integration

### Add Items via API

```javascript
await fetch("/api/inventory", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    org_id: "your-org-id",
    items: [
      {
        name: "Product Name",
        sku: "SKU-001",
        invoice: "INV-12345", // ← Track batch
        quantity: 100,
        reorder_threshold: 20,
        expiration_date: "2026-03-30",
      },
    ],
  }),
});
```

### Update by Invoice

```javascript
// Get all items from invoice
const items = await fetch(`/api/inventory?org_id=your-org-id`).then((r) =>
  r.json()
);

const batchItems = items.items.filter((i) => i.invoice === "INV-12345");

// Update each
for (const item of batchItems) {
  await fetch(`/api/inventory/${item.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expiration_date: "2026-06-30",
    }),
  });
}
```

---

## 🆘 Troubleshooting

### Invoice column not showing?

1. Run the SQL update in Supabase
2. Refresh the page
3. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Can't bulk edit?

- You need at least 2 items with the same invoice number
- The "Edit Batch" button only appears when there are multiple items

### Import failing?

- Make sure CSV has `invoice` column header
- Invoice field is optional - leave blank if not tracking batches

---

## ✅ Summary

You can now:

- ✅ **Track batches** with invoice numbers
- ✅ **Add items manually** with full form
- ✅ **Edit individual items** with modal
- ✅ **Bulk edit by invoice** for entire batches
- ✅ **Delete items** individually
- ✅ **Search by invoice** to find batches
- ✅ **Import CSV** with invoice column

**Perfect for managing multiple product lots with different expiry dates!** 🎉
