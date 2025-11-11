import { NextRequest, NextResponse } from 'next/server';
import { syncInventoryItems } from '@/lib/inventory/syncInventoryItems';

/**
 * POST /api/inventory/sync
 * Sync inventory from external sources (Shopify, Square, BigCommerce, etc.)
 * With optional AI labeling
 *
 * Body: {
 *   org_id: string,
 *   source: 'shopify' | 'square' | 'custom' | 'bigcommerce' | string,
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

    const { success, results, summary } = await syncInventoryItems({
      orgId: org_id,
      source,
      items,
      enableAiLabeling: enable_ai_labeling,
    });

    return NextResponse.json({
      success,
      results,
      summary,
    });
  } catch (error: any) {
    console.error('Error in POST /api/inventory/sync:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
