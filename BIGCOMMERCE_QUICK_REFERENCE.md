# 🚀 BigCommerce Onboarding - Quick Reference

## What You Need (4 Things)

1. **Store Hash** - From BigCommerce Admin → Advanced Settings → API Accounts
2. **Client ID** - From your API Account in BigCommerce
3. **Access Token** - From your API Account (with product/inventory scopes)
4. **Organization Name** - Client's company name

## One API Call

```bash
POST https://your-domain.com/api/onboarding/bigcommerce
```

**Body:**
```json
{
  "organization_name": "Client Name",
  "user_email": "admin@client.com",
  "user_full_name": "Admin Name",
  "bigcommerce_store_hash": "abc123",
  "bigcommerce_client_id": "client_id",
  "bigcommerce_access_token": "token",
  "perform_initial_sync": true
}
```

## Response

You'll get back:
- ✅ `organization.id` - Save this for webhooks
- ✅ `user.id` - Client can sign in with the email
- ✅ `initial_sync.results` - How many products were imported

## That's It! 🎉

The client can now:
- Sign in at `/auth/signin`
- See all their BigCommerce products
- Use all LastCall features

---

**Full Documentation**: See `BIGCOMMERCE_ONBOARDING.md` for detailed instructions.

