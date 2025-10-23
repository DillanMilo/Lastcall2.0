# 🚀 API Quick Start Guide

Get up and running with the LastCall API in 5 minutes!

---

## ✅ What You Have Now

**3 New API Endpoints:**

- `/api/inventory` - List & Create items
- `/api/inventory/[id]` - Get, Update, Delete specific items
- `/api/inventory/sync` - Sync from external sources (Shopify, Square, etc.)

---

## 🧪 Test It Right Now!

### Option 1: Browser Console (Easiest)

1. **Open your app**: http://localhost:3000/dashboard
2. **Open browser console** (F12 or Cmd+Option+I)
3. **Paste and run:**

```javascript
// Get all inventory via API
fetch("/api/inventory?org_id=00000000-0000-0000-0000-000000000001")
  .then((r) => r.json())
  .then((data) => console.log("📦 Inventory:", data));

// Create new item via API
fetch("/api/inventory", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    org_id: "00000000-0000-0000-0000-000000000001",
    items: [
      {
        name: "API Test Product",
        sku: "API-001",
        quantity: 100,
        reorder_threshold: 25,
      },
    ],
  }),
})
  .then((r) => r.json())
  .then((data) => console.log("✅ Created:", data));
```

---

### Option 2: cURL (Terminal)

```bash
# Get all inventory
curl "http://localhost:3000/api/inventory?org_id=00000000-0000-0000-0000-000000000001"

# Create new item
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "00000000-0000-0000-0000-000000000001",
    "items": [{
      "name": "New Product via API",
      "sku": "NEW-001",
      "quantity": 50
    }]
  }'
```

---

### Option 3: Node.js Test Script

**Run the test script I created:**

```bash
node test-api.js
```

This will test all endpoints automatically! ✅

---

## 🔌 Common Use Cases

### 1. Shopify Integration

Sync your Shopify inventory automatically:

```javascript
// Webhook handler for Shopify inventory updates
async function syncShopify(shopifyData) {
  const items = shopifyData.products.map((p) => ({
    name: p.title,
    sku: p.sku,
    quantity: p.inventory_quantity,
    reorder_threshold: 10,
  }));

  const response = await fetch("http://localhost:3000/api/inventory/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org_id: "your-org-id",
      source: "shopify",
      enable_ai_labeling: true,
      items,
    }),
  });

  return response.json();
}
```

---

### 2. Update Quantity After Sale

Track sales in real-time:

```javascript
async function recordSale(itemId, quantitySold) {
  // Get current quantity
  const item = await fetch(
    `http://localhost:3000/api/inventory/${itemId}`
  ).then((r) => r.json());

  // Calculate new quantity
  const newQuantity = item.item.quantity - quantitySold;

  // Update
  await fetch(`http://localhost:3000/api/inventory/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity: newQuantity }),
  });
}
```

---

### 3. Bulk Import from CSV API

Import from external CSV APIs:

```javascript
async function importFromCSVAPI(csvUrl) {
  const response = await fetch(csvUrl);
  const csvText = await response.text();

  // Parse CSV (using papaparse or similar)
  const items = parseCSV(csvText);

  // Sync to LastCall
  await fetch("http://localhost:3000/api/inventory/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org_id: "00000000-0000-0000-0000-000000000001",
      source: "csv_api",
      items,
    }),
  });
}
```

---

### 4. Square Integration

```javascript
async function syncSquare(squareInventory) {
  const items = squareInventory.map((item) => ({
    name: item.name,
    sku: item.sku,
    quantity: item.quantity,
  }));

  await fetch("http://localhost:3000/api/inventory/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org_id: "your-org-id",
      source: "square",
      items,
    }),
  });
}
```

---

## 📋 API Cheat Sheet

| Method | Endpoint                    | Purpose                   |
| ------ | --------------------------- | ------------------------- |
| GET    | `/api/inventory?org_id=...` | List all items            |
| GET    | `/api/inventory/:id`        | Get one item              |
| POST   | `/api/inventory`            | Create item(s)            |
| PUT    | `/api/inventory/:id`        | Update item (full)        |
| PATCH  | `/api/inventory/:id`        | Update item (partial)     |
| DELETE | `/api/inventory/:id`        | Delete item               |
| POST   | `/api/inventory/sync`       | Sync from external source |

---

## 🎯 Try These Tests

### Test 1: Get Your Current Inventory

```bash
curl "http://localhost:3000/api/inventory?org_id=00000000-0000-0000-0000-000000000001"
```

You should see all 10 Angus Biltong products you imported earlier!

---

### Test 2: Add a New Product

```bash
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "00000000-0000-0000-0000-000000000001",
    "items": [{
      "name": "Angus Biltong Chili 100g",
      "sku": "ANG-CHILI-100",
      "quantity": 200,
      "reorder_threshold": 40,
      "expiration_date": "2025-07-31"
    }]
  }'
```

Then check your inventory page - the new item should appear!

---

### Test 3: Update Quantity

First get an item ID from your inventory, then:

```bash
curl -X PATCH http://localhost:3000/api/inventory/{ITEM_ID} \
  -H "Content-Type: application/json" \
  -d '{"quantity": 275}'
```

Refresh your inventory page - quantity updated!

---

## 📚 Full Documentation

For complete API reference, see: **`API_DOCUMENTATION.md`**

Includes:

- All endpoints and parameters
- Request/response examples
- Error handling
- Integration examples for Shopify, Square, etc.
- Security best practices

---

## 🎉 You're Ready!

Your API is live and ready for:

- ✅ External integrations
- ✅ Automated inventory sync
- ✅ Real-time updates
- ✅ Third-party apps
- ✅ Custom workflows

**Next:** Check out `API_DOCUMENTATION.md` for advanced usage!
