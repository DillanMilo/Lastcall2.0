# 🚀 BigCommerce Client Onboarding Guide

This guide will help you quickly onboard new BigCommerce clients to LastCall 2.0.

## 📋 What You Need From Your Client

**Note:** This is for **BigCommerce** integration. For **custom API** imports, see `CLIENT_API_INFO_REQUEST.md`.

Before onboarding, collect these **4 pieces of information** from your client's BigCommerce account:

### 1. **Store Hash** 
- Found in: BigCommerce Admin → **Advanced Settings** → **API Accounts**
- Format: Usually 6-8 characters (e.g., `abc123`)
- This is the unique identifier for their store

### 2. **Client ID**
- Found in: BigCommerce Admin → **Advanced Settings** → **API Accounts** → Your API Account
- Format: Long alphanumeric string
- This identifies your API application

### 3. Access Token
- Found in: BigCommerce Admin → **Advanced Settings** → **API Accounts** → Your API Account → **OAuth Scopes**
- Format: Long alphanumeric string
- **Important**: Make sure the token has these scopes:
  - `store/products/read`
  - `store/products/modify`
  - `store/inventory/read`
  - `store/inventory/modify`
- **Note**: You do NOT need the Client Secret - only the Access Token is required

### 4. Organization Name
- The name of the client's company/organization
- This will be displayed in their dashboard

### Optional (Recommended):
- **User Email**: Admin email for the client account
- **User Full Name**: Admin's full name

---

## 🎯 Quick Onboarding (Single API Call)

### Step 1: Make the API Request

Send a `POST` request to:
```
https://your-domain.com/api/onboarding/bigcommerce
```

**Request Body:**
```json
{
  "organization_name": "Client Company Name",
  "user_email": "admin@client.com",
  "user_full_name": "Admin Name",
  "bigcommerce_store_hash": "abc123",
  "bigcommerce_client_id": "your_client_id_here",
  "bigcommerce_access_token": "your_access_token_here",
  "enable_ai_labeling": false,
  "perform_initial_sync": true
}
```

### Step 2: Check the Response

**Success Response:**
```json
{
  "success": true,
  "organization": {
    "id": "uuid-here",
    "name": "Client Company Name",
    "subscription_tier": "growth"
  },
  "user": {
    "id": "user-uuid",
    "email": "admin@client.com"
  },
  "connection_test": {
    "success": true,
    "store_name": "Client Store",
    "store_domain": "store.bigcommerce.com"
  },
  "initial_sync": {
    "success": true,
    "results": {
      "created": 150,
      "updated": 0,
      "failed": 0,
      "errors": []
    },
    "summary": "Created: 150, Updated: 0, Failed: 0",
    "items_synced": 150
  },
  "next_steps": [
    "Set up webhook in BigCommerce (see documentation)",
    "Configure webhook secret in environment variables",
    "User can now sign in and access dashboard"
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "BigCommerce connection test failed",
  "details": "API error message here",
  "step": "connection_test"
}
```

---

## 📝 Example: Using cURL

```bash
curl -X POST https://your-domain.com/api/onboarding/bigcommerce \
  -H "Content-Type: application/json" \
  -d '{
    "organization_name": "Angus Biltong",
    "user_email": "admin@angusbiltong.com",
    "user_full_name": "John Doe",
    "bigcommerce_store_hash": "abc123",
    "bigcommerce_client_id": "your_client_id",
    "bigcommerce_access_token": "your_access_token",
    "enable_ai_labeling": false,
    "perform_initial_sync": true
  }'
```

---

## 📝 Example: Using JavaScript/Node.js

```javascript
const response = await fetch('https://your-domain.com/api/onboarding/bigcommerce', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    organization_name: 'Client Company Name',
    user_email: 'admin@client.com',
    user_full_name: 'Admin Name',
    bigcommerce_store_hash: 'abc123',
    bigcommerce_client_id: 'your_client_id',
    bigcommerce_access_token: 'your_access_token',
    enable_ai_labeling: false,
    perform_initial_sync: true,
  }),
});

const result = await response.json();
console.log('Onboarding result:', result);
```

---

## ✅ What Happens During Onboarding

1. **Connection Test**: Verifies BigCommerce credentials are valid
2. **Organization Creation**: Creates a new organization in LastCall
3. **User Account** (optional): Creates user account if email provided
4. **Initial Sync**: Imports all products/variants from BigCommerce
5. **Returns**: Organization ID, user ID, and sync results

---

## 🔧 Setting Up Webhooks (After Onboarding)

After successful onboarding, set up webhooks in BigCommerce to keep inventory in sync:

1. Go to BigCommerce Admin → **Advanced Settings** → **Webhooks**
2. Create a new webhook with these settings:
   - **Event**: Product Created, Product Updated, Product Deleted, Product Inventory Updated, Variant Created, Variant Updated, Variant Deleted
   - **Destination URL**: `https://your-domain.com/api/webhooks/bigcommerce`
   - **Format**: JSON
   - **Include**: Product ID, Variant ID
   - **Secret**: Generate a secure random string (you'll use this in step 4)

3. Add `org_id` to webhook payload (custom field):
   - Use the `organization.id` from the onboarding response
   - This ensures webhooks are routed to the correct organization

4. Set webhook secret in your environment variables:
   ```
   BIGCOMMERCE_WEBHOOK_SECRET=the_secret_you_created_in_step_2
   ```
   
   **Note**: The webhook secret is something YOU create and configure, not something from the client. It's used to verify webhook signatures for security.

---

## 🐛 Troubleshooting

### Connection Test Fails
- **Check**: Store hash, client ID, and access token are correct
- **Check**: Access token has required scopes
- **Check**: Store is active and accessible

### Initial Sync Returns 0 Items
- **Check**: Store has products in BigCommerce
- **Check**: Products have inventory tracking enabled
- **Check**: API credentials have read permissions

### User Account Not Created
- **Check**: Email is valid and not already in use
- **Check**: SUPABASE_SERVICE_ROLE_KEY is configured
- **Note**: User can still sign up manually using the email

---

## 📞 Support

If you encounter issues during onboarding:
1. Check the error response for the `step` field to identify where it failed
2. Verify all credentials are correct
3. Check server logs for detailed error messages

---

## 🎉 After Onboarding

Once onboarding is complete:
- Client can sign in at `/auth/signin` using the email you provided
- All their BigCommerce products are synced and visible in the dashboard
- Webhooks will keep inventory in sync automatically
- Client can use all LastCall features (AI assistant, bulk edits, etc.)

