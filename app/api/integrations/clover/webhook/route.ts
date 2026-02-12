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
 * Supports multi-merchant: looks up org via clover_connections table.
 * Both physical and online store webhooks are processed through this endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature - reject if secret is not configured
    if (!webhookSecret) {
      console.error('CLOVER_WEBHOOK_SECRET is not configured - rejecting webhook');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const signature = request.headers.get('x-clover-signature') || '';
    if (!verifyCloverWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('Clover webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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
      if (!Array.isArray(events)) continue;
      // Look up the connection from clover_connections table
      const { data: connection } = await adminClient
        .from('clover_connections')
        .select('id, org_id, access_token, label')
        .eq('merchant_id', merchantId)
        .single();

      if (!connection || !connection.access_token) {
        console.warn(`No Clover connection found for merchant: ${merchantId}`);
        continue;
      }

      // Get org-level settings (thrive validation mode)
      const { data: org } = await adminClient
        .from('organizations')
        .select('thrive_validation_mode')
        .eq('id', connection.org_id)
        .single();

      const isValidationMode = org?.thrive_validation_mode === true;

      // Process each event
      for (const event of events) {
        const { objectId, type } = event;

        if (!objectId) continue;

        if (type === 'DELETE') {
          console.log(`Clover item deleted: ${objectId} for merchant ${merchantId} (${connection.label})`);
          continue;
        }

        if (type === 'CREATE' || type === 'UPDATE') {
          const cloverItem = await fetchCloverItem(
            {
              merchantId,
              accessToken: connection.access_token,
            },
            objectId
          );

          if (cloverItem) {
            // Tag the item with which merchant it came from
            const taggedItem = {
              ...cloverItem,
              clover_merchant_id: merchantId,
            };

            // Sync this single item (always - we want to capture all data even in validation mode)
            await syncInventoryItems({
              orgId: connection.org_id,
              source: 'clover',
              items: [taggedItem],
              enableAiLabeling: false,
            });

            // In validation mode, log extra detail for Thrive comparison auditing
            if (isValidationMode) {
              try {
                // Look up current quantity to record accurate previous_quantity
                const { data: currentItem } = await adminClient
                  .from('inventory_items')
                  .select('quantity')
                  .eq('org_id', connection.org_id)
                  .eq('clover_item_id', objectId)
                  .limit(1)
                  .maybeSingle();

                const previousQty = currentItem?.quantity ?? 0;
                const newQty = typeof cloverItem.quantity === 'number' ? cloverItem.quantity : 0;

                await adminClient
                  .from('inventory_history')
                  .insert([{
                    org_id: connection.org_id,
                    item_name: cloverItem.name,
                    sku: cloverItem.sku ?? null,
                    previous_quantity: previousQty,
                    new_quantity: newQty,
                    quantity_change: newQty - previousQty,
                    change_type: 'thrive_validation',
                    source: `clover_webhook_${type.toLowerCase()}_${merchantId}`,
                  }]);
              } catch {
                // Validation logging is non-critical
              }
            }

            console.log(`Synced Clover item ${objectId} from ${connection.label} (${merchantId}) for org ${connection.org_id}${isValidationMode ? ' [THRIVE VALIDATION]' : ''}`);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clover webhook error:', error);
    return NextResponse.json({ success: true, note: 'Processed with errors' });
  }
}
