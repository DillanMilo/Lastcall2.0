import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { generateAiLabel } from '@/lib/ai/labelGenerator';

/**
 * POST /api/inventory/sync
 * Sync inventory from external sources (Shopify, Square, etc.)
 * With optional AI labeling
 * 
 * Body: {
 *   org_id: string,
 *   source: 'shopify' | 'square' | 'custom',
 *   items: [...],
 *   enable_ai_labeling: boolean (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, source, items, enable_ai_labeling = false } = body;

    if (!org_id || !source || !items) {
      return NextResponse.json(
        { error: 'org_id, source, and items are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items must be a non-empty array' },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each item
    for (const item of items) {
      try {
        if (!item.name) {
          results.failed++;
          results.errors.push('Item missing name field');
          continue;
        }

        // Optional AI labeling
        let aiData = { category: null, ai_label: null };
        if (enable_ai_labeling) {
          const aiResult = await generateAiLabel(item.name);
          if (aiResult.status === 'success') {
            aiData = {
              category: aiResult.category || null,
              ai_label: aiResult.label || null,
            };
          }
        }

        const itemData = {
          org_id,
          name: item.name,
          sku: item.sku || null,
          invoice: item.invoice || null,
          quantity: parseInt(item.quantity || '0', 10),
          reorder_threshold: parseInt(item.reorder_threshold || '0', 10),
          category: item.category || aiData.category,
          ai_label: item.ai_label || aiData.ai_label,
          expiration_date: item.expiration_date || null,
        };

        // Check if item exists by SKU
        if (item.sku) {
          const { data: existing } = await supabase
            .from('inventory_items')
            .select('id')
            .eq('org_id', org_id)
            .eq('sku', item.sku)
            .single();

          if (existing) {
            // Update existing item
            const { error } = await supabase
              .from('inventory_items')
              .update(itemData)
              .eq('id', existing.id);

            if (error) throw error;
            results.updated++;
            continue;
          }
        }

        // Create new item
        const { error } = await supabase
          .from('inventory_items')
          .insert([itemData]);

        if (error) throw error;
        results.created++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${item.name || 'Unknown'}: ${error.message}`);
      }
    }

    // Log the import
    await supabase
      .from('imports')
      .insert([{
        org_id,
        source,
        status: results.failed === 0 ? 'completed' : 'completed_with_errors',
      }]);

    return NextResponse.json({
      success: true,
      results,
      summary: `Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/inventory/sync:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

