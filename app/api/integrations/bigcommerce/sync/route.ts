import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { fetchBigCommerceCatalogItemsWithCredentials } from '@/lib/integrations/bigcommerce';
import { syncInventoryItems } from '@/lib/inventory/syncInventoryItems';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Verify user is authenticated and belongs to the specified organization
 */
async function verifyUserOrg(request: NextRequest, orgId: string): Promise<{ valid: boolean; error?: string }> {
  const response = NextResponse.next();
  
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

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
 * POST /api/integrations/bigcommerce/sync
 * Fetches the latest catalog from BigCommerce and upserts inventory records.
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
    const body = await request.json();
    const { org_id, enable_ai_labeling = false } = body;

    if (!org_id) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    // Verify user belongs to this organization
    const authCheck = await verifyUserOrg(request, org_id);
    if (!authCheck.valid) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: 403 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Fetch organization to get BigCommerce credentials
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token')
      .eq('id', org_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!org.bigcommerce_store_hash || !org.bigcommerce_client_id || !org.bigcommerce_access_token) {
      return NextResponse.json(
        { error: 'BigCommerce is not connected. Please configure your credentials in Settings.' },
        { status: 400 }
      );
    }

    const items = await fetchBigCommerceCatalogItemsWithCredentials({
      storeHash: org.bigcommerce_store_hash,
      clientId: org.bigcommerce_client_id,
      accessToken: org.bigcommerce_access_token,
    });

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
      { error: errorMessage, details: errorMessage },
      { status: 500 }
    );
  }
}
