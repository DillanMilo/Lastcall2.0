import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  verifyCloverWebhookSignature,
  parseCloverWebhookPayload,
  fetchCloverItem,
} from '@/lib/integrations/clover';
import { syncInventoryItems } from '@/lib/inventory/syncInventoryItems';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const webhookSecret = process.env.CLOVER_WEBHOOK_SECRET || '';

/**
 * POST /api/integrations/clover/webhook
 * Handle incoming webhooks from Clover for inventory updates
 *
 * Clover sends webhooks for:
 * - Item CREATE/UPDATE/DELETE
 * - Order CREATE (for sales tracking)
 * - Inventory UPDATE
 *
 * Webhook payload format:
 * {
 *   "merchants": {
 *     "MERCHANT_ID": [
 *       { "objectId": "ITEM_ID", "type": "UPDATE", "ts": 1234567890 }
 *     ]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = request.headers.get('x-clover-signature') || '';

      if (!verifyCloverWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error('Clover webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = parseCloverWebhookPayload(rawBody);

    if (!payload.merchants || typeof payload.merchants !== 'object') {
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Process events for each merchant
    for (const [merchantId, events] of Object.entries(payload.merchants)) {
      // Find the organization with this Clover merchant ID
      const { data: org, error: orgError } = await adminClient
        .from('organizations')
        .select('id, clover_access_token')
        .eq('clover_merchant_id', merchantId)
        .single();

      if (orgError || !org || !org.clover_access_token) {
        console.warn(`No organization found for Clover merchant: ${merchantId}`);
        continue;
      }

      // Process each event
      for (const event of events) {
        const { objectId, type } = event;

        // We're mainly interested in item updates for inventory tracking
        // objectId could be an item ID for inventory events
        if (!objectId) continue;

        if (type === 'DELETE') {
          // Item was deleted in Clover - we might want to mark it or delete it
          // For now, log it but don't delete from our system
          console.log(`Clover item deleted: ${objectId} for merchant ${merchantId}`);
          continue;
        }

        if (type === 'CREATE' || type === 'UPDATE') {
          // Fetch the updated item from Clover
          const cloverItem = await fetchCloverItem(
            {
              merchantId,
              accessToken: org.clover_access_token,
            },
            objectId
          );

          if (cloverItem) {
            // Sync this single item
            await syncInventoryItems({
              orgId: org.id,
              source: 'clover',
              items: [cloverItem],
              enableAiLabeling: false, // Don't run AI on webhook updates
            });

            console.log(`Synced Clover item ${objectId} for org ${org.id}`);
          }
        }
      }
    }

    // Clover expects a 200 response to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clover webhook error:', error);
    // Still return 200 to avoid Clover retrying failed webhooks
    // Log the error for investigation
    return NextResponse.json({ success: true, note: 'Processed with errors' });
  }
}
