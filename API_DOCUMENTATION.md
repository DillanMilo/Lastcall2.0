# 🔌 LastCall 2.0 API Documentation

Complete API reference for integrating with LastCall inventory management system.

---

## 🔑 Authentication

Currently using organization ID (`org_id`) for authentication. In production, you'll want to add API keys or OAuth.

**Your Angus Biltong Org ID:**

```
00000000-0000-0000-0000-000000000001
```

---

## 📡 Base URL

**Development:** `http://localhost:3000/api`  
**Production:** `https://your-domain.com/api`

---

## 📦 Endpoints

### 1. Get All Inventory Items

**GET** `/api/inventory?org_id={org_id}`

Fetch all inventory items for an organization.

**Query Parameters:**

- `org_id` (required) - Organization UUID

**Example Request:**

```bash
curl "http://localhost:3000/api/inventory?org_id=00000000-0000-0000-0000-000000000001"
```

**Response:**

```json
{
  "success": true,
  "count": 10,
  "items": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "name": "Angus Biltong Original 100g",
      "sku": "ANG-ORIG-100",
      "quantity": 45,
      "reorder_threshold": 50,
      "category": "meat",
      "ai_label": "weekly",
      "expiration_date": "2026-03-30",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### 2. Get Single Item

**GET** `/api/inventory/{id}`

Fetch a specific inventory item by ID.

**Example Request:**

```bash
curl "http://localhost:3000/api/inventory/550e8400-e29b-41d4-a716-446655440000"
```

**Response:**

```json
{
  "success": true,
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Angus Biltong Original 100g",
    "sku": "ANG-ORIG-100",
    "quantity": 45,
    ...
  }
}
```

---

### 3. Create Inventory Items

**POST** `/api/inventory`

Create one or more inventory items.

**Request Body:**

```json
{
  "org_id": "00000000-0000-0000-0000-000000000001",
  "items": [
    {
      "name": "New Product",
      "sku": "NEW-001",
      "quantity": 100,
      "reorder_threshold": 20,
      "category": "snack",
      "expiration_date": "2025-12-31"
    }
  ]
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "00000000-0000-0000-0000-000000000001",
    "items": [
      {
        "name": "Test Product",
        "sku": "TEST-001",
        "quantity": 50,
        "reorder_threshold": 10
      }
    ]
  }'
```

**Response:**

```json
{
  "success": true,
  "count": 1,
  "items": [
    {
      "id": "new-uuid",
      "name": "Test Product",
      ...
    }
  ]
}
```

---

### 4. Update Item (Full)

**PUT** `/api/inventory/{id}`

Replace an entire inventory item (full update).

**Request Body:**

```json
{
  "name": "Updated Product Name",
  "sku": "UPD-001",
  "quantity": 150,
  "reorder_threshold": 30,
  "category": "updated_category"
}
```

**Example Request:**

```bash
curl -X PUT http://localhost:3000/api/inventory/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Biltong",
    "quantity": 300
  }'
```

---

### 5. Update Item (Partial)

**PATCH** `/api/inventory/{id}`

Update specific fields only (partial update).

**Request Body:**

```json
{
  "quantity": 200
}
```

**Example Request:**

```bash
curl -X PATCH http://localhost:3000/api/inventory/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"quantity": 200}'
```

**Common Use Case - Update Quantity:**

```bash
# Decrease quantity after sale
curl -X PATCH http://localhost:3000/api/inventory/{id} \
  -H "Content-Type: application/json" \
  -d '{"quantity": 245}'
```

---

### 6. Delete Item

**DELETE** `/api/inventory/{id}`

Delete an inventory item.

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/inventory/550e8400-e29b-41d4-a716-446655440000
```

**Response:**

```json
{
  "success": true,
  "message": "Item deleted successfully"
}
```

---

### 7. Sync Inventory (Shopify, Square, etc.)

**POST** `/api/inventory/sync`

Sync inventory from external sources with smart upsert (create or update).

**Request Body:**

```json
{
  "org_id": "00000000-0000-0000-0000-000000000001",
  "source": "shopify",
  "enable_ai_labeling": true,
  "items": [
    {
      "name": "Product from Shopify",
      "sku": "SHOP-001",
      "quantity": 75,
      "reorder_threshold": 15
    }
  ]
}
```

**Parameters:**

- `org_id` (required) - Organization UUID
- `source` (required) - Source name: "shopify", "square", "bigcommerce", "custom", etc.
- `enable_ai_labeling` (optional) - Enable AI categorization (default: false)
- `items` (required) - Array of items to sync

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/inventory/sync \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "00000000-0000-0000-0000-000000000001",
    "source": "shopify",
    "enable_ai_labeling": true,
    "items": [
      {"name": "Shopify Product", "sku": "SHOP-001", "quantity": 100}
    ]
  }'
```

**Response:**

```json
{
  "success": true,
  "results": {
    "created": 5,
    "updated": 3,
    "failed": 0,
    "errors": []
  },
  "summary": "Created: 5, Updated: 3, Failed: 0"
}
```

**Behavior:**

- If item with matching SKU exists → **Updates** it
- If item doesn't exist → **Creates** it
- Logs import in `imports` table

---

### 8. BigCommerce Catalog Sync

**POST** `/api/integrations/bigcommerce/sync`

Pull the latest catalog (products and variants) from BigCommerce and upsert them into LastCall inventory.

**Environment prerequisites:**

- `BIGCOMMERCE_STORE_HASH`
- `BIGCOMMERCE_CLIENT_ID`
- `BIGCOMMERCE_ACCESS_TOKEN`

**Request Body:**

```json
{
  "org_id": "00000000-0000-0000-0000-000000000001",
  "enable_ai_labeling": false
}
```

**Response:**

```json
{
  "success": true,
  "results": {
    "created": 10,
    "updated": 42,
    "failed": 0,
    "errors": []
  },
  "summary": "Created: 10, Updated: 42, Failed: 0",
  "imported": 52
}
```

---

### 9. BigCommerce Webhook

**POST** `/api/webhooks/bigcommerce`

Accepts webhook calls from BigCommerce for product and variant create/update/delete events.

**Environment prerequisites:**

- `BIGCOMMERCE_WEBHOOK_SECRET`
- `BIGCOMMERCE_DEFAULT_ORG_ID` (or include `org_id` in the webhook payload)

**Behavior:**

- Validates the `X-BC-Signature` header using the configured webhook secret.
- Fetches the latest product/variant inventory from BigCommerce and upserts it locally.
- Removes the corresponding record when a product or variant is deleted.

**Response:**

```json
{
  "success": true,
  "summary": "Created: 0, Updated: 1, Failed: 0",
  "results": {
    "created": 0,
    "updated": 1,
    "failed": 0,
    "errors": []
  }
}
```

---

## 🔧 Integration Examples

### Shopify Webhook

```javascript
// Shopify webhook handler example
app.post("/webhooks/shopify/inventory", async (req, res) => {
  const shopifyProducts = req.body.products;

  const items = shopifyProducts.map((p) => ({
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

  const result = await response.json();
  res.json(result);
});
```

---

### Square Integration

```javascript
// Square inventory sync
async function syncSquareInventory() {
  const squareItems = await squareClient.catalog.list();

  const items = squareItems.objects.map((item) => ({
    name: item.item_data.name,
    sku: item.item_data.variations[0].item_variation_data.sku,
    quantity:
      item.item_data.variations[0].item_variation_data
        .inventory_alert_threshold,
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

### Custom Integration

```javascript
// Generic API integration
async function syncCustomInventory(apiData) {
  const items = apiData.map((item) => ({
    name: item.productName,
    sku: item.productCode,
    quantity: item.stockLevel,
    reorder_threshold: item.minStock,
    expiration_date: item.expiryDate,
  }));

  const response = await fetch("http://localhost:3000/api/inventory/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org_id: "00000000-0000-0000-0000-000000000001",
      source: "custom_api",
      enable_ai_labeling: true,
      items,
    }),
  });

  return response.json();
}
```

---

### Real-time Quantity Updates

```javascript
// Update quantity after a sale
async function recordSale(itemId, quantitySold) {
  // Get current quantity
  const item = await fetch(
    `http://localhost:3000/api/inventory/${itemId}`
  ).then((r) => r.json());

  const newQuantity = item.item.quantity - quantitySold;

  // Update quantity
  await fetch(`http://localhost:3000/api/inventory/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity: newQuantity }),
  });
}
```

---

## 🛡️ Error Responses

**400 Bad Request:**

```json
{
  "error": "org_id is required"
}
```

**404 Not Found:**

```json
{
  "error": "Item not found"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to create inventory items",
  "details": "Error message"
}
```

---

## 🔐 Security (Future Enhancement)

For production, implement:

1. **API Keys:**

   ```
   Authorization: Bearer your-api-key
   ```

2. **Rate Limiting:**

   - 100 requests per minute per org

3. **Webhook Signatures:**

   - Verify external webhook authenticity

4. **CORS Configuration:**
   - Whitelist allowed domains

---

## 📊 Rate Limits (Future)

- **Free Tier**: 1,000 API calls/day
- **Growth Tier**: 10,000 API calls/day
- **Enterprise**: Unlimited

---

## 🧪 Testing Your API

### Test with cURL:

```bash
# 1. Get all items
curl "http://localhost:3000/api/inventory?org_id=00000000-0000-0000-0000-000000000001"

# 2. Create an item
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{"org_id":"00000000-0000-0000-0000-000000000001","items":[{"name":"API Test","sku":"API-001","quantity":99}]}'

# 3. Update quantity
curl -X PATCH http://localhost:3000/api/inventory/{id} \
  -H "Content-Type: application/json" \
  -d '{"quantity":150}'
```

### Test with JavaScript:

```javascript
// Test in browser console
async function testAPI() {
  const res = await fetch(
    "/api/inventory?org_id=00000000-0000-0000-0000-000000000001"
  );
  const data = await res.json();
  console.log(data);
}
testAPI();
```

---

## 📚 Next Steps

1. **Test the API** with the examples above
2. **Integrate with your systems** (Shopify, Square, etc.)
3. **Add authentication** for production
4. **Set up webhooks** for real-time sync
5. **Monitor usage** in Supabase

---

**Need help?** Check the main `README.md` or `SUPABASE_SETUP.md` for more information!
