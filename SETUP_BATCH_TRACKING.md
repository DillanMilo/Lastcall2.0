# 🚀 Set Up Batch Tracking - Quick Start

## Step 1: Update Database (2 minutes)

**Go to Supabase → SQL Editor → Run this:**

```sql
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS invoice TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_invoice ON inventory_items(invoice);

COMMENT ON COLUMN inventory_items.invoice IS 'Invoice/batch number for tracking product lots with different expiry dates';
```

Click **"RUN"** → Should see "Success. No rows returned"

---

## Step 2: Refresh Your App

1. **Hard refresh your browser**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Go to: http://localhost:3000/dashboard/inventory

---

## Step 3: Test It Out!

### Option A: Import the Updated CSV

1. Go to **Dashboard → Import**
2. Upload the new `sample-inventory.csv` (it now has invoice column!)
3. Click **Import**
4. Go to **Inventory** page

You should see:

- ✅ **Invoice column** with batch numbers (INV-12345, INV-123456, etc.)
- ✅ **"Edit Batch (X)"** buttons for invoices with multiple items
- ✅ Same product (Mixed Nuts) appears twice with different invoices/expiry dates

### Option B: Add Item Manually

1. Click **"Add Item"** button (top right)
2. Fill in the form:
   - Name: "Test Product"
   - SKU: "TEST-001"
   - **Invoice: "INV-TEST"** ← New field!
   - Quantity: 100
   - Reorder Point: 20
   - Expiry: Select a date
3. Click **"Add Item"**
4. Item appears in table!

---

## Step 4: Try Editing

### Edit Single Item

1. Find any item in your table
2. Click the **Edit** button (pencil icon)
3. Change any field
4. Click **"Save Changes"**

### Bulk Edit by Invoice

1. Find an item with invoice number (e.g., "INV-12345")
2. Click **"Edit Batch (3)"** button
3. In the modal:
   - Update invoice number
   - Update expiry date for all items
   - Adjust quantities (e.g., +10 or -5)
4. Click **"Update X Item(s)"**
5. All items with that invoice are updated!

---

## ✨ What You Now Have

✅ **Invoice/Batch Tracking**

- Same product, different batches
- Track expiry dates per batch
- FIFO (First In, First Out) inventory management

✅ **Add Items Manually**

- Full form with all fields
- No need for CSV imports

✅ **Edit Individual Items**

- Update any field
- Delete items
- Clean modal interface

✅ **Bulk Edit by Invoice**

- Update entire batches at once
- Change invoice numbers
- Adjust quantities
- Update expiry dates

✅ **Enhanced Search**

- Search by name, SKU, OR invoice number
- Find entire batches instantly

---

## 📋 Use Cases

### Scenario 1: New Shipment Arrives

**You receive Invoice INV-OCT-2025 with 5 products**

**Option A:** Create CSV and import

```csv
name,sku,invoice,quantity,reorder_threshold,expiration_date
Product 1,SKU-1,INV-OCT-2025,100,20,2026-04-30
Product 2,SKU-2,INV-OCT-2025,75,15,2026-04-30
...
```

**Option B:** Use "Add Item" button 5 times

---

### Scenario 2: Same Product, Different Batches

**Mixed Nuts arrives in 3 shipments:**

```
Batch 1: INV-JAN | 50 units | Expires: 2025-12-31
Batch 2: INV-FEB | 75 units | Expires: 2026-03-31
Batch 3: INV-MAR | 100 units | Expires: 2026-06-30
```

**In your inventory, you now have 3 separate entries for Mixed Nuts.**

**Benefits:**

- Sell oldest batch first (FIFO)
- Track expiry dates accurately
- Bulk edit if needed (e.g., batch recall)

---

### Scenario 3: Batch Recall

**Invoice INV-BAD-123 is contaminated**

1. Search: "INV-BAD-123"
2. Click **"Edit Batch (X)"**
3. Adjust Quantity → **-999** (or to 0)
4. All items from that batch set to 0
5. Delete manually or leave for records

---

### Scenario 4: Extended Shelf Life

**Supplier extends expiry for Invoice INV-12345**

1. Find any item with INV-12345
2. Click **"Edit Batch (3)"**
3. Update Expiry Date → 2026-09-30
4. All 3 items updated at once!

---

## 🎯 Next Steps

1. **Run the SQL** in Supabase (Step 1)
2. **Refresh browser** (Step 2)
3. **Import updated CSV** or **Add items manually** (Step 3)
4. **Try editing** - both single and bulk (Step 4)

---

## 📚 Documentation

- **Full Guide**: `BATCH_TRACKING_GUIDE.md`
- **API Docs**: `API_DOCUMENTATION.md` (updated with invoice field)
- **Setup**: `SUPABASE_SETUP.md`

---

**Ready to track your batches! 🎉**

Questions? Check `BATCH_TRACKING_GUIDE.md` for detailed examples and troubleshooting.
