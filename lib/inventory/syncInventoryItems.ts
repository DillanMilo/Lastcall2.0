import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateAiLabel } from '@/lib/ai/labelGenerator';

// Use service role client for server-side operations to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

function getAdminClient(): AdminClient {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface InventorySyncItem {
  name: string;
  sku?: string | null;
  invoice?: string | null;
  quantity?: number | string | null;
  reorder_threshold?: number | string | null;
  category?: string | null;
  ai_label?: string | null;
  expiration_date?: string | null;
  bigcommerce_product_id?: string | number | null;
  bigcommerce_variant_id?: string | number | null;
  shopify_product_id?: string | number | null;
  shopify_variant_id?: string | number | null;
  clover_item_id?: string | null;
  clover_merchant_id?: string | null;
}

export interface InventorySyncResult {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface SyncInventoryOptions {
  orgId: string;
  source: string;
  items: InventorySyncItem[];
  enableAiLabeling?: boolean;
}

export interface SyncInventoryResponse {
  success: boolean;
  results: InventorySyncResult;
  summary: string;
}

const KNOWN_SOURCES = new Set(['shopify', 'square', 'custom', 'bigcommerce', 'clover']);

function parseInteger(value: InventorySyncItem['quantity']): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function findExistingInventoryItem(
  supabase: AdminClient,
  orgId: string,
  item: InventorySyncItem
) {
  // Match by SKU first (most reliable)
  if (item.sku) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('org_id', orgId)
      .eq('sku', item.sku)
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      return data[0];
    }
  }

  // Fallback: match by name (less reliable but better than duplicates)
  if (item.name) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', item.name)
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      return data[0];
    }
  }

  return null;
}

export async function syncInventoryItems({
  orgId,
  source,
  items,
  enableAiLabeling = false,
}: SyncInventoryOptions): Promise<SyncInventoryResponse> {
  if (!orgId) {
    throw new Error('orgId is required for inventory sync');
  }

  if (!source) {
    throw new Error('source is required for inventory sync');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  // Use admin client to bypass RLS for server-side operations
  const supabase = getAdminClient();

  const results: InventorySyncResult = {
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  const normalizedSource = source.toLowerCase();
  const sourceLabel = KNOWN_SOURCES.has(normalizedSource)
    ? normalizedSource
    : source;

  // Process items in batches with throttling to avoid API rate limits
  const BATCH_SIZE = 25;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    
    // Process batch items in parallel (but limit AI calls)
    const batchPromises = batch.map(async (item) => {
      try {
        if (!item.name) {
          return { status: 'failed', error: 'Item missing name field' };
        }

        let aiData: { category: string | null; ai_label: string | null } = {
          category: null,
          ai_label: null,
        };

        // Only do AI labeling for new items and limit to avoid rate limits
        if (enableAiLabeling && !item.ai_label && !item.category) {
          try {
            const aiResult = await generateAiLabel(item.name);
            if (aiResult.status === 'success') {
              aiData = {
                category: aiResult.category ?? null,
                ai_label: aiResult.label ?? null,
              };
            }
          } catch {
            // AI labeling failed, continue without it
          }
        }

        // Build base item data (bigcommerce columns may not exist in DB yet)
        // Items synced from external sources (BigCommerce, Shopify, etc.) are always stock items
        const itemData: Record<string, unknown> = {
          org_id: orgId,
          name: item.name,
          sku: item.sku ?? null,
          invoice: item.invoice ?? null,
          quantity: parseInteger(item.quantity),
          reorder_threshold: parseInteger(item.reorder_threshold),
          category: item.category ?? aiData.category,
          ai_label: item.ai_label ?? aiData.ai_label,
          expiration_date: item.expiration_date ?? null,
          item_type: 'stock', // Synced items are always stock (not operational)
        };

        // Include Clover-specific fields when present
        if (item.clover_item_id) {
          itemData.clover_item_id = item.clover_item_id;
        }
        if (item.clover_merchant_id) {
          itemData.clover_merchant_id = item.clover_merchant_id;
        }

        const existing = await findExistingInventoryItem(supabase, orgId, item);
        const newQuantity = parseInteger(item.quantity);

        if (existing) {
          // Get current quantity for history tracking
          const { data: currentItem } = await supabase
            .from('inventory_items')
            .select('quantity')
            .eq('id', existing.id)
            .single();

          const previousQuantity = currentItem?.quantity ?? 0;
          const quantityChange = newQuantity - previousQuantity;

          const { error: updateError } = await supabase
            .from('inventory_items')
            .update(itemData)
            .eq('id', existing.id);

          if (updateError) throw updateError;

          // Log quantity change to history (only if quantity changed)
          if (quantityChange !== 0) {
            try {
              await supabase
                .from('inventory_history')
                .insert([{
                  org_id: orgId,
                  item_id: existing.id,
                  item_name: item.name,
                  sku: item.sku ?? null,
                  previous_quantity: previousQuantity,
                  new_quantity: newQuantity,
                  quantity_change: quantityChange,
                  change_type: 'sync',
                  source: sourceLabel,
                }]);
            } catch {
              // History table might not exist yet - ignore error
            }
          }

          return { status: 'updated' };
        }

        const { data: insertedItem, error: insertError } = await supabase
          .from('inventory_items')
          .insert([itemData])
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Log initial stock as a restock in history
        if (insertedItem && newQuantity > 0) {
          try {
            await supabase
              .from('inventory_history')
              .insert([{
                org_id: orgId,
                item_id: insertedItem.id,
                item_name: item.name,
                sku: item.sku ?? null,
                previous_quantity: 0,
                new_quantity: newQuantity,
                quantity_change: newQuantity,
                change_type: 'sync',
                source: sourceLabel,
              }]);
          } catch {
            // History table might not exist yet - ignore error
          }
        }

        return { status: 'created' };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to sync item';
        return { status: 'failed', error: `${item.name || 'Unknown'}: ${message}` };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'created') {
        results.created += 1;
      } else if (result.status === 'updated') {
        results.updated += 1;
      } else if (result.status === 'failed') {
        results.failed += 1;
        if (result.error) {
          results.errors.push(result.error);
        }
      }
    }

    // Throttle between batches to avoid API rate limits
    if (i + BATCH_SIZE < items.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  await supabase.from('imports').insert([
    {
      org_id: orgId,
      source: sourceLabel,
      status: results.failed === 0 ? 'completed' : 'completed_with_errors',
    },
  ]);

  return {
    success: results.failed === 0,
    results,
    summary: `Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
  };
}
