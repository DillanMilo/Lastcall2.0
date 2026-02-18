import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { decryptToken } from '@/lib/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Check if a duplicate history entry was already written recently (within 60s).
 * Prevents webhook retries from creating duplicate inventory_history entries.
 */
async function isDuplicateHistoryEntry(
  orgId: string,
  itemId: string,
  newQuantity: number,
): Promise<boolean> {
  try {
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { data } = await db
      .from('inventory_history')
      .select('id')
      .eq('org_id', orgId)
      .eq('item_id', itemId)
      .eq('new_quantity', newQuantity)
      .eq('source', 'bigcommerce')
      .gte('created_at', sixtySecondsAgo)
      .limit(1);
    return (data && data.length > 0) || false;
  } catch {
    return false;
  }
}

/**
 * Verify BigCommerce webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.BIGCOMMERCE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('BIGCOMMERCE_WEBHOOK_SECRET not configured - rejecting webhook for security');
    return false;
  }
  
  if (!signature) {
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Fetch a single product from BigCommerce and update inventory
 */
async function syncProductFromBigCommerce(
  productId: number,
  storeHash: string,
  clientId: string,
  accessToken: string,
  orgId: string
) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch product details from BigCommerce
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products/${productId}?include=variants`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': accessToken,
      'X-Auth-Client': clientId,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Product was deleted - we could mark it as deleted in our DB
      console.log(`Product ${productId} not found (possibly deleted)`);
      return { action: 'not_found', productId };
    }
    throw new Error(`Failed to fetch product: ${response.status}`);
  }

  const { data: product } = await response.json();
  const variants = product.variants || [];

  const results = { updated: 0, created: 0 };

  // Process product and its variants
  const itemsToSync = [];
  
  if (variants.length > 0) {
    for (const variant of variants) {
      itemsToSync.push({
        name: buildVariantName(product.name, variant),
        sku: variant.sku || product.sku || null,
        quantity: variant.inventory_level ?? product.inventory_level ?? 0,
        reorder_threshold: variant.inventory_warning_level ?? product.inventory_warning_level ?? 0,
      });
    }
  } else {
    itemsToSync.push({
      name: product.name,
      sku: product.sku || null,
      quantity: product.inventory_level ?? 0,
      reorder_threshold: product.inventory_warning_level ?? 0,
    });
  }

  // Upsert each item
  for (const item of itemsToSync) {
    // Try to find existing item by SKU first, then by name
    let existing = null;
    
    if (item.sku) {
      const { data } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('org_id', orgId)
        .eq('sku', item.sku)
        .limit(1);
      existing = data?.[0];
    }
    
    if (!existing && item.name) {
      const { data } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('org_id', orgId)
        .eq('name', item.name)
        .limit(1);
      existing = data?.[0];
    }

    if (existing) {
      // Get current quantity for history tracking
      const { data: currentItem } = await supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', existing.id)
        .single();

      const previousQuantity = currentItem?.quantity ?? 0;
      const quantityChange = item.quantity - previousQuantity;

      await supabase
        .from('inventory_items')
        .update({
          quantity: item.quantity,
          reorder_threshold: item.reorder_threshold,
        })
        .eq('id', existing.id);

      // Log quantity change to history (ignore errors if table doesn't exist)
      // Also check for duplicates to prevent webhook retries from double-counting
      if (quantityChange !== 0) {
        const isDupe = await isDuplicateHistoryEntry(orgId, existing.id, item.quantity);
        if (!isDupe) {
          try {
            await supabase
              .from('inventory_history')
              .insert([{
                org_id: orgId,
                item_id: existing.id,
                item_name: item.name,
                sku: item.sku,
                previous_quantity: previousQuantity,
                new_quantity: item.quantity,
                quantity_change: quantityChange,
                change_type: 'webhook',
                source: 'bigcommerce',
              }]);
          } catch {
            // History table might not exist yet - ignore
          }
        }
      }

      results.updated++;
    } else {
      const { data: inserted } = await supabase
        .from('inventory_items')
        .insert([{
          org_id: orgId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          reorder_threshold: item.reorder_threshold,
        }])
        .select('id')
        .single();

      // Log initial stock in history (ignore errors if table doesn't exist)
      if (inserted && item.quantity > 0) {
        try {
          await supabase
            .from('inventory_history')
            .insert([{
              org_id: orgId,
              item_id: inserted.id,
              item_name: item.name,
              sku: item.sku,
              previous_quantity: 0,
              new_quantity: item.quantity,
              quantity_change: item.quantity,
              change_type: 'webhook',
              source: 'bigcommerce',
            }]);
        } catch {
          // History table might not exist yet - ignore
        }
      }

      results.created++;
    }
  }

  return results;
}

function buildVariantName(productName: string, variant: { option_values?: Array<{ option_display_name?: string; label?: string }>; sku?: string }): string {
  const optionSummary = variant.option_values
    ?.filter((v) => v.option_display_name && v.label)
    .map((v) => `${v.option_display_name}: ${v.label}`)
    .join(', ');

  if (optionSummary && optionSummary.length > 0) {
    return `${productName} (${optionSummary})`;
  }

  if (variant.sku) {
    return `${productName} (${variant.sku})`;
  }

  return productName;
}

/**
 * Find organization by store hash
 */
async function findOrgByStoreHash(storeHash: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('organizations')
    .select('id, bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token')
    .eq('bigcommerce_store_hash', storeHash)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
}

/**
 * POST /api/integrations/bigcommerce/webhook
 * Receives webhook notifications from BigCommerce
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-bc-webhook-signature');
    
    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    
    console.log('BigCommerce webhook received:', payload.scope, payload.store_id);

    // Extract store hash from the webhook
    const storeHash = payload.producer?.split('/')[1] || payload.store_id;
    
    if (!storeHash) {
      console.error('No store hash in webhook payload');
      return NextResponse.json({ error: 'Missing store hash' }, { status: 400 });
    }

    // Find organization with this store hash
    const org = await findOrgByStoreHash(storeHash);
    
    if (!org) {
      console.error(`No organization found for store hash: ${storeHash}`);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Handle different webhook scopes
    const scope = payload.scope;
    const data = payload.data;

    if (scope?.includes('product') || scope?.includes('inventory')) {
      // Extract product ID
      const productId = data?.id || data?.product_id || data?.inventory?.product_id;
      
      if (productId) {
        const result = await syncProductFromBigCommerce(
          productId,
          org.bigcommerce_store_hash,
          org.bigcommerce_client_id,
          decryptToken(org.bigcommerce_access_token),
          org.id
        );
        
        console.log(`Synced product ${productId}:`, result);
        
        return NextResponse.json({
          success: true,
          message: `Product ${productId} synced`,
          result,
        });
      }
    }

    // Acknowledge receipt even if we don't process it
    return NextResponse.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/bigcommerce/webhook
 * Health check endpoint for webhook verification
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

