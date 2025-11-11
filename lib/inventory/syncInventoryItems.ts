import { supabase } from '@/lib/supabaseClient';
import { generateAiLabel } from '@/lib/ai/labelGenerator';

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

const KNOWN_SOURCES = new Set(['shopify', 'square', 'custom', 'bigcommerce']);

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

async function findExistingInventoryItem(orgId: string, item: InventorySyncItem) {
  if (item.bigcommerce_variant_id) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('org_id', orgId)
      .eq('bigcommerce_variant_id', String(item.bigcommerce_variant_id))
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      return data[0];
    }
  }

  if (item.bigcommerce_product_id && item.sku) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('org_id', orgId)
      .eq('bigcommerce_product_id', String(item.bigcommerce_product_id))
      .eq('sku', item.sku)
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      return data[0];
    }
  }

  if (item.bigcommerce_product_id) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('org_id', orgId)
      .eq('bigcommerce_product_id', String(item.bigcommerce_product_id))
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      return data[0];
    }
  }

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

  for (const item of items) {
    try {
      if (!item.name) {
        results.failed += 1;
        results.errors.push('Item missing name field');
        continue;
      }

      let aiData: { category: string | null; ai_label: string | null } = {
        category: null,
        ai_label: null,
      };

      if (enableAiLabeling && !item.ai_label && !item.category) {
        const aiResult = await generateAiLabel(item.name);
        if (aiResult.status === 'success') {
          aiData = {
            category: aiResult.category ?? null,
            ai_label: aiResult.label ?? null,
          };
        }
      }

      const itemData = {
        org_id: orgId,
        name: item.name,
        sku: item.sku ?? null,
        invoice: item.invoice ?? null,
        quantity: parseInteger(item.quantity),
        reorder_threshold: parseInteger(item.reorder_threshold),
        category: item.category ?? aiData.category,
        ai_label: item.ai_label ?? aiData.ai_label,
        expiration_date: item.expiration_date ?? null,
        bigcommerce_product_id: item.bigcommerce_product_id
          ? String(item.bigcommerce_product_id)
          : null,
        bigcommerce_variant_id: item.bigcommerce_variant_id
          ? String(item.bigcommerce_variant_id)
          : null,
      };

      const existing = await findExistingInventoryItem(orgId, item);

      if (existing) {
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update(itemData)
          .eq('id', existing.id);

        if (updateError) throw updateError;
        results.updated += 1;
        continue;
      }

      const { error: insertError } = await supabase
        .from('inventory_items')
        .insert([itemData]);

      if (insertError) throw insertError;
      results.created += 1;
    } catch (error: any) {
      results.failed += 1;
      results.errors.push(
        `${item.name || 'Unknown'}: ${error?.message || 'Failed to sync item'}`
      );
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
