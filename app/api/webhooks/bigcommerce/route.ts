import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { fetchBigCommerceVariantInventory } from '@/lib/integrations/bigcommerce';
import { syncInventoryItems } from '@/lib/inventory/syncInventoryItems';
import { supabase } from '@/lib/supabaseClient';

const RELEVANT_SCOPES = new Set([
  'store/product/created',
  'store/product/updated',
  'store/product/deleted',
  'store/product/inventory/updated',
  'store/product/variant/created',
  'store/product/variant/updated',
  'store/product/variant/deleted',
]);

function verifySignature(secret: string, signature: string, payload: string): boolean {
  const computed = createHmac('sha256', secret).update(payload).digest('base64');
  return computed === signature;
}

export async function POST(request: NextRequest) {
  const secret = process.env.BIGCOMMERCE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('BigCommerce webhook secret is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const signature = request.headers.get('x-bc-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing BigCommerce signature header' },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  if (!verifySignature(secret, signature, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { scope?: string; org_id?: string; [key: string]: unknown };
  try {
    payload = JSON.parse(rawBody) as { scope?: string; org_id?: string; [key: string]: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const scope = payload.scope as string | undefined;
  if (!scope || !RELEVANT_SCOPES.has(scope)) {
    return NextResponse.json({ success: true, message: 'Event ignored' });
  }

  const orgId = payload.org_id || process.env.BIGCOMMERCE_DEFAULT_ORG_ID;
  if (!orgId) {
    console.error('No org_id provided for BigCommerce webhook');
    return NextResponse.json(
      { error: 'org_id not provided and no default configured' },
      { status: 400 }
    );
  }

  const data = (payload.data as { product_id?: string | number; id?: string | number } | undefined) || {};
  const productIdRaw = data.product_id ?? data.id;
  const productId = typeof productIdRaw === 'string' ? Number(productIdRaw) : productIdRaw;
  const isVariantScope = scope.includes('variant');
  const variantIdRaw = isVariantScope ? data.id : undefined;
  let variantId = typeof variantIdRaw === 'string' ? Number(variantIdRaw) : variantIdRaw;
  if (variantId !== undefined && Number.isNaN(variantId)) {
    variantId = undefined;
  }

  if (!productId || Number.isNaN(productId)) {
    return NextResponse.json(
      { error: 'Webhook payload missing product identifier' },
      { status: 400 }
    );
  }

  const isDeleteEvent = scope.includes('deleted');

  if (isDeleteEvent) {
    try {
      let query = supabase
        .from('inventory_items')
        .delete({ count: 'exact' })
        .eq('org_id', orgId);

      if (isVariantScope && variantId) {
        query = query.eq('bigcommerce_variant_id', String(variantId));
      } else {
        query = query.eq('bigcommerce_product_id', String(productId));
      }

      const { error, count } = await query;

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        removed: count ?? 0,
        message: 'Inventory item removed after BigCommerce delete event',
      });
    } catch (error: unknown) {
      console.error('Error removing inventory for BigCommerce delete event:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove inventory item';
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  }

  try {
    const items = await fetchBigCommerceVariantInventory(productId, variantId);

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matching items found for webhook event',
      });
    }

    const { success, results, summary } = await syncInventoryItems({
      orgId,
      source: 'bigcommerce',
      items,
      enableAiLabeling: false,
    });

    return NextResponse.json({ success, results, summary });
  } catch (error: unknown) {
    console.error('Error handling BigCommerce webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process BigCommerce webhook';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
