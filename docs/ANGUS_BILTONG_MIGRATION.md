# Angus Biltong Migration Plan

## Overview
Angus Biltong is transitioning from Thrive (inventory) → BigCommerce → Clover to using **LastCall as the source of truth** for inventory.

**Current state:** Thrive feeds BigCommerce, which may or may not feed Clover.
**Target state:** LastCall manages inventory and pushes to BigCommerce AND Clover.

---

## Pre-Migration Checklist

### 1. Database Setup ✅
The following columns have been added to your Supabase database:
- [x] `billing_exempt` on `organizations` table
- [x] `clover_merchant_id` on `organizations` table
- [x] `clover_access_token` on `organizations` table
- [x] `clover_connected_at` on `organizations` table
- [x] `clover_item_id` on `inventory_items` table

### 2. Set Angus Biltong as Billing Exempt
Run this SQL in Supabase (replace the ID with their actual org ID from the SELECT results):

```sql
-- First, confirm their org ID:
SELECT id, name FROM organizations WHERE name ILIKE '%angus%';

-- Then set billing_exempt = true:
UPDATE organizations
SET billing_exempt = true
WHERE id = 'PASTE_THEIR_ORG_ID_HERE';

-- Verify:
SELECT id, name, billing_exempt FROM organizations WHERE name ILIKE '%angus%';
```

**What this does:** Angus Biltong will see "Enterprise Account" in their billing section with unlimited access, and won't see any upgrade prompts or billing nags.

---

## Research Questions (Before Migration)

You need to find out from Angus Biltong:

### Question 1: How does Clover currently get inventory?
- [ ] Does BigCommerce push to Clover automatically?
- [ ] Does Thrive push to Clover directly?
- [ ] Are they manually syncing?
- [ ] Is Clover inventory completely separate?

### Question 2: What is their Clover setup?
- [ ] Get their **Clover Merchant ID**
- [ ] Get their **Clover API Access Token** (from Clover Developer Portal)
- [ ] Confirm if they're US or EU Clover (most likely US)

### Question 3: BigCommerce sync direction
- [ ] Is BigCommerce currently pushing TO their POS?
- [ ] Or is it just receiving FROM Thrive?

---

## Migration Steps

### Phase 1: Initial Sync (Non-Destructive)
These steps don't change anything for their daily operations.

1. **Sync BigCommerce → LastCall**
   - They likely already have this connected
   - Run a manual sync to pull all products into LastCall
   - Verify product counts match

2. **Connect Clover** (read-only first)
   - Use their Clover credentials
   - Run `/api/integrations/clover/sync` to pull Clover inventory
   - Compare with BigCommerce data - identify any mismatches

3. **Reconcile Data**
   - Match products by SKU between BigCommerce and Clover
   - Identify any products that exist in one but not the other
   - Set `clover_item_id` on inventory items that match

### Phase 2: Test Bi-Directional Sync
Before going live, test with a few items.

1. **Test LastCall → Clover push**
   - Pick 2-3 test products
   - Change quantity in LastCall
   - Call `/api/integrations/clover/push`
   - Verify it updates in Clover POS

2. **Test webhook (Clover → LastCall)**
   - Make a sale in Clover for a test product
   - Verify the quantity decrements in LastCall

### Phase 3: Cut Over from Thrive
This is the actual migration - do this during low-traffic hours.

1. **Disable Thrive → BigCommerce sync**
   - Work with Angus to turn off Thrive's feed to BigCommerce
   - This is on their end / Thrive's end

2. **Enable LastCall as source of truth**
   - Set up webhook URLs in Clover pointing to LastCall
   - Ensure BigCommerce webhooks are registered

3. **Final sync**
   - Do one final pull from both systems
   - Push LastCall inventory to both BigCommerce and Clover
   - This ensures all three systems are in sync

### Phase 4: Go Live
1. **Monitor for 24-48 hours**
   - Watch for sync errors in logs
   - Check inventory_history table for movement tracking
   - Verify sales in Clover decrement LastCall inventory

2. **Set up alerts (optional)**
   - Low stock alerts
   - Sync failure notifications

---

## API Endpoints Reference

### Clover Integration
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/clover/connect` | POST | Save Clover credentials |
| `/api/integrations/clover/connect` | DELETE | Disconnect Clover |
| `/api/integrations/clover/sync` | POST | Pull inventory FROM Clover |
| `/api/integrations/clover/push` | POST | Push inventory TO Clover |
| `/api/integrations/clover/webhook` | POST | Receive Clover events |

### Connect Clover (POST body)
```json
{
  "merchant_id": "XXXXXXXXXX",
  "access_token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "environment": "us"
}
```

### Push to Clover (POST body)
```json
{
  "item_id": "single-item-uuid",
  "create_if_missing": true
}
// OR for bulk:
{
  "item_ids": ["uuid1", "uuid2", "uuid3"],
  "create_if_missing": true
}
```

---

## Environment Variables Needed

Add to your `.env.local` or Vercel environment:

```
CLOVER_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## Rollback Plan

If something goes wrong:

1. **Re-enable Thrive → BigCommerce** (on their end)
2. LastCall data remains intact - no data loss
3. Clover continues to work independently
4. Investigate and fix issues before retrying

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Research & Credentials | 1-2 days (depends on client) |
| Phase 1: Initial Sync | 1 day |
| Phase 2: Testing | 2-3 days |
| Phase 3: Cut Over | 1 day (off-hours) |
| Phase 4: Monitoring | 2-3 days |

**Total:** ~1-2 weeks, mostly waiting on client for credentials and scheduling.

---

## Questions?

Contact Dillan for any questions about this migration plan.
