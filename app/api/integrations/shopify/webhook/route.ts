import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
      .eq('source', 'shopify')
      .gte('created_at', sixtySecondsAgo)
      .limit(1);
    return (data && data.length > 0) || false;
  } catch {
    return false;
  }
}

/**
 * Verify Shopify webhook signature using HMAC
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  // If no secret configured, skip verification (not recommended for production)
  if (!secret) {
    console.warn('SHOPIFY_WEBHOOK_SECRET not configured - skipping signature verification');
    return true;
  }

  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  sku?: string;
  inventory_quantity?: number;
  option1?: string;
  option2?: string;
  option3?: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
  options?: Array<{ name: string; position: number }>;
}

/**
 * Build a descriptive variant name
 */
function buildVariantName(
  productTitle: string,
  variant: ShopifyVariant,
  options?: Array<{ name: string; position: number }>
): string {
  // If there's only one variant with title "Default Title", just use product name
  if (variant.title === 'Default Title') {
    return productTitle;
  }

  // Build option string from variant options
  const optionParts: string[] = [];

  if (variant.option1 && options?.[0]) {
    optionParts.push(`${options[0].name}: ${variant.option1}`);
  }
  if (variant.option2 && options?.[1]) {
    optionParts.push(`${options[1].name}: ${variant.option2}`);
  }
  if (variant.option3 && options?.[2]) {
    optionParts.push(`${options[2].name}: ${variant.option3}`);
  }

  if (optionParts.length > 0) {
    return `${productTitle} (${optionParts.join(', ')})`;
  }

  // Fallback to variant title
  if (variant.title && variant.title !== 'Default Title') {
    return `${productTitle} (${variant.title})`;
  }

  return productTitle;
}

/**
 * Sync a product from Shopify webhook payload
 */
async function syncProductFromWebhook(
  product: ShopifyProduct,
  orgId: string
) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = { updated: 0, created: 0 };

  for (const variant of product.variants) {
    const itemName = buildVariantName(product.title, variant, product.options);

    // Try to find existing item by SKU first, then by name
    let existing = null;

    if (variant.sku) {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .eq('org_id', orgId)
        .eq('sku', variant.sku)
        .limit(1);
      existing = data?.[0];
    }

    if (!existing) {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .eq('org_id', orgId)
        .eq('name', itemName)
        .limit(1);
      existing = data?.[0];
    }

    const newQuantity = variant.inventory_quantity ?? 0;

    if (existing) {
      const previousQuantity = existing.quantity ?? 0;
      const quantityChange = newQuantity - previousQuantity;

      await supabase
        .from('inventory_items')
        .update({
          quantity: newQuantity,
          name: itemName,
          sku: variant.sku || null,
        })
        .eq('id', existing.id);

      // Log quantity change to history (with dedup check for webhook retries)
      if (quantityChange !== 0) {
        const isDupe = await isDuplicateHistoryEntry(orgId, existing.id, newQuantity);
        if (!isDupe) {
          try {
            await supabase
              .from('inventory_history')
              .insert([{
                org_id: orgId,
                item_id: existing.id,
                item_name: itemName,
                sku: variant.sku || null,
                previous_quantity: previousQuantity,
                new_quantity: newQuantity,
                quantity_change: quantityChange,
                change_type: 'webhook',
                source: 'shopify',
              }]);
          } catch {
            // History table might not exist - ignore
          }
        }
      }

      results.updated++;
    } else {
      const { data: insertedItem } = await supabase
        .from('inventory_items')
        .insert([{
          org_id: orgId,
          name: itemName,
          sku: variant.sku || null,
          quantity: newQuantity,
          reorder_threshold: 0,
        }])
        .select('id')
        .single();

      // Log initial stock
      if (insertedItem && newQuantity > 0) {
        try {
          await supabase
            .from('inventory_history')
            .insert([{
              org_id: orgId,
              item_id: insertedItem.id,
              item_name: itemName,
              sku: variant.sku || null,
              previous_quantity: 0,
              new_quantity: newQuantity,
              quantity_change: newQuantity,
              change_type: 'webhook',
              source: 'shopify',
            }]);
        } catch {
          // History table might not exist - ignore
        }
      }

      results.created++;
    }
  }

  return results;
}

/**
 * Find organization by Shopify store domain
 */
async function findOrgByStoreDomain(storeDomain: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Normalize the domain for matching
  const normalizedDomain = storeDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

  const { data, error } = await supabase
    .from('organizations')
    .select('id, shopify_store_domain, shopify_access_token')
    .eq('shopify_store_domain', normalizedDomain)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
}

/**
 * POST /api/integrations/shopify/webhook
 * Receives webhook notifications from Shopify
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-shopify-hmac-sha256');

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid Shopify webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const topic = request.headers.get('x-shopify-topic');
    const shopDomain = request.headers.get('x-shopify-shop-domain');

    console.log('Shopify webhook received:', topic, shopDomain);

    if (!shopDomain) {
      console.error('No shop domain in webhook headers');
      return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 });
    }

    // Find organization with this store
    const org = await findOrgByStoreDomain(shopDomain);

    if (!org) {
      console.error(`No organization found for shop: ${shopDomain}`);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Handle different webhook topics
    if (topic === 'products/create' || topic === 'products/update') {
      const result = await syncProductFromWebhook(payload as ShopifyProduct, org.id);
      console.log(`Synced product from Shopify:`, result);

      return NextResponse.json({
        success: true,
        message: `Product synced`,
        result,
      });
    }

    if (topic === 'products/delete') {
      // Optionally mark products as deleted
      console.log(`Product deleted in Shopify: ${payload.id}`);
      return NextResponse.json({
        success: true,
        message: 'Product deletion acknowledged',
      });
    }

    if (topic === 'inventory_levels/update') {
      // Handle inventory level updates
      const inventoryItemId = payload.inventory_item_id;
      const newQuantity = payload.available;

      console.log(`Inventory update: item ${inventoryItemId}, quantity ${newQuantity}`);

      // For inventory level updates, we need to find the product by inventory_item_id
      // This is more complex and would require additional API calls or stored mappings
      // For now, acknowledge receipt and let the full sync handle it
      return NextResponse.json({
        success: true,
        message: 'Inventory update received',
      });
    }

    // Acknowledge receipt even if we don't process it
    return NextResponse.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Shopify webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/shopify/webhook
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Shopify webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
