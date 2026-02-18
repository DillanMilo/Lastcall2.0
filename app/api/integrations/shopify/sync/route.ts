import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { fetchAllShopifyProducts } from '@/lib/integrations/shopify';
import { syncInventoryItems } from '@/lib/inventory/syncInventoryItems';
import { decryptToken } from '@/lib/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Verify user is authenticated and belongs to the specified organization
 */
async function verifyUserOrg(request: NextRequest, orgId: string): Promise<{ valid: boolean; error?: string }> {
  const { supabase } = createRouteHandlerClient(request);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { valid: false, error: 'Unauthorized' };
  }

  // Verify user belongs to this organization
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData || userData.org_id !== orgId) {
    return { valid: false, error: 'Access denied - you do not belong to this organization' };
  }

  return { valid: true };
}

/**
 * POST /api/integrations/shopify/sync
 * Fetches the latest catalog from Shopify and upserts inventory records.
 * Uses stored credentials from the organization.
 * Verifies user belongs to the organization before syncing.
 *
 * Body: {
 *   org_id: string,
 *   enable_ai_labeling?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const body = await request.json();
    const { org_id, enable_ai_labeling = false } = body;

    if (!org_id) {
      return jsonResponse(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    // Verify user belongs to this organization
    const authCheck = await verifyUserOrg(request, org_id);
    if (!authCheck.valid) {
      return jsonResponse(
        { error: authCheck.error },
        { status: 403 }
      );
    }

    if (!serviceRoleKey) {
      return jsonResponse(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Fetch organization to get Shopify credentials
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('shopify_store_domain, shopify_access_token')
      .eq('id', org_id)
      .single();

    if (orgError || !org) {
      return jsonResponse(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!org.shopify_store_domain || !org.shopify_access_token) {
      return jsonResponse(
        { error: 'Shopify is not connected. Please configure your credentials in Settings.' },
        { status: 400 }
      );
    }

    const items = await fetchAllShopifyProducts({
      storeDomain: org.shopify_store_domain,
      accessToken: decryptToken(org.shopify_access_token),
    });

    if (items.length === 0) {
      return jsonResponse({
        success: true,
        results: { created: 0, updated: 0, failed: 0, errors: [] },
        summary: 'No items returned from Shopify',
      });
    }

    const { success, results, summary } = await syncInventoryItems({
      orgId: org_id,
      source: 'shopify',
      items,
      enableAiLabeling: enable_ai_labeling,
    });

    return jsonResponse({
      success,
      results,
      summary,
      imported: items.length,
    });
  } catch (error: unknown) {
    console.error('Error syncing Shopify catalog:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync Shopify catalog';
    return NextResponse.json(
      { error: errorMessage, details: errorMessage },
      { status: 500 }
    );
  }
}
