# 📋 What to Ask Your Client for API Import Setup

When setting up API import for a client, ask them for the following information:

## ✅ Required Information

### 1. **API Endpoint URL**

- The full URL to their inventory API endpoint
- Example: `https://api.clientstore.com/inventory`
- Example: `https://api.clientstore.com/v1/products`

**Ask them:** "What's the URL to your inventory/product API endpoint?"

---

## 🔑 Optional (But Usually Needed)

### 2. **API Key / Access Token**

- If their API requires authentication
- This will be sent as a Bearer token in the Authorization header
- Example: `sk_live_abc123xyz`

**Ask them:** "Does your API require an API key or access token? If so, what is it?"

---

## 📊 Helpful Information (For Field Mapping)

### 3. **API Response Structure**

Ask them to share a sample API response or documentation. You need to know:

- **Where are the items?**

  - Is it an array at the root? `[{...}, {...}]`
  - Or nested? `{ data: { items: [...] } }`
  - Or `{ products: [...] }`

- **What are the field names?**
  - Product name field: `name`, `title`, `product_name`?
  - SKU field: `sku`, `product_code`, `item_number`?
  - Quantity field: `quantity`, `stock`, `inventory`, `qty`?
  - Other fields they have (invoice, reorder threshold, expiration date, etc.)

**Ask them:** "Can you share a sample API response or documentation? I need to know the field names and structure."

---

## 🎯 Quick Checklist

Send this to your client:

```
Hi! To set up your API import, I need:

1. ✅ API Endpoint URL: _______________________
2. 🔑 API Key (if required): _______________________
3. 📄 Sample API Response or Documentation

Optional but helpful:
- Field name for product name: _______________
- Field name for SKU: _______________
- Field name for quantity/stock: _______________
```

---

## 💡 Example Client Response

**Good response:**

```
API Endpoint: https://api.mystore.com/v2/products
API Key: sk_live_abc123xyz789
Sample Response:
{
  "data": {
    "products": [
      {
        "title": "Product Name",
        "product_code": "SKU-001",
        "stock_level": 100,
        "reorder_point": 20
      }
    ]
  }
}
```

**What you'd configure:**

- API Endpoint URL: `https://api.mystore.com/v2/products`
- API Key: `sk_live_abc123xyz789`
- Items Path: `data.products`
- Name Field: `title`
- SKU Field: `product_code`
- Quantity Field: `stock_level`
- Reorder Threshold Field: `reorder_point`

---

## 🚀 After You Get the Info

1. Go to `/dashboard/import` in LastCall
2. Fill in the "Connect via API" form:
   - Source: Select "Custom" (or Shopify/Square if applicable)
   - API Endpoint URL: Paste their endpoint
   - API Key: Paste their key (if provided)
   - Items Path: Enter the path to the items array (e.g., `data.products` or leave blank if root level)
   - Field Mappings: Map their field names to LastCall fields
3. Click "Fetch & Sync"
4. Done! ✅

---

## ❓ If They Don't Know

If your client doesn't know their API structure:

1. **Ask for API documentation** - Most APIs have docs
2. **Ask for a test endpoint** - They might have a sandbox/test environment
3. **Use a sample response** - Ask them to make a test API call and share the JSON response
4. **Start with defaults** - Try with default field names (`name`, `sku`, `quantity`) and adjust if needed

---

## 🔍 Testing the Connection

After setup, the system will:

1. Test the connection to their API
2. Fetch the data
3. Map the fields
4. Import all items
5. Show you a summary (created/updated/failed)

If it fails, check:

- ✅ API endpoint is correct and accessible
- ✅ API key is valid (if required)
- ✅ Items path matches their response structure
- ✅ Field mappings match their field names
