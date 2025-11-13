import { NextRequest, NextResponse } from 'next/server';
import { fetchBigCommerceCatalogItems } from '@/lib/integrations/bigcommerce';
import { syncInventoryItems } from '@/lib/inventory/syncInventoryItems';

/**
 * POST /api/integrations/bigcommerce/sync
 * Fetches the latest catalog from BigCommerce and upserts inventory records.
 *
 * Body: {
 *   org_id: string,
 *   enable_ai_labeling?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, enable_ai_labeling = false } = body;

    if (!org_id) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    const items = await fetchBigCommerceCatalogItems();

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        results: { created: 0, updated: 0, failed: 0, errors: [] },
        summary: 'No items returned from BigCommerce',
      });
    }

    const { success, results, summary } = await syncInventoryItems({
      orgId: org_id,
      source: 'bigcommerce',
      items,
      enableAiLabeling: enable_ai_labeling,
    });

    return NextResponse.json({
      success,
      results,
      summary,
      imported: items.length,
    });
  } catch (error: unknown) {
    console.error('Error syncing BigCommerce catalog:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync BigCommerce catalog';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
