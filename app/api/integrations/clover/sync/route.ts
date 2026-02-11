import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { fetchCloverInventoryItems } from '@/lib/integrations/clover';
import { syncInventoryItems } from '@/lib/inventory/syncInventoryItems';
import { checkIntegrationAccess } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface CloverConnectionRow {
  id: string;
  merchant_id: string;
  access_token: string;
  label: string;
  environment: string;
}

/**
 * POST /api/integrations/clover/sync
 * Pull inventory items from all connected Clover merchants and sync to LastCall
 *
 * Optional request body:
 * - enableAiLabeling: boolean
 * - connection_id: string (sync only a specific merchant)
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.next();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { response.cookies.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { response.cookies.set({ name, value: '', ...options }); },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
    if (!userData?.org_id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const orgId = userData.org_id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check tier access
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier, billing_exempt')
      .eq('id', orgId)
      .single();

    if (orgError || !org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const tier = (org.subscription_tier || 'free') as PlanTier;
    const billingExempt = org.billing_exempt === true;
    const integrationCheck = checkIntegrationAccess(tier, 'clover', billingExempt);

    if (!integrationCheck.allowed) {
      return NextResponse.json({
        error: integrationCheck.message || 'Clover integration requires Growth plan or higher'
      }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const enableAiLabeling = body.enableAiLabeling === true;
    const specificConnectionId = body.connection_id as string | undefined;

    // Get all Clover connections (or a specific one)
    let connectionsQuery = adminClient
      .from('clover_connections')
      .select('id, merchant_id, access_token, label, environment')
      .eq('org_id', orgId);

    if (specificConnectionId) {
      connectionsQuery = connectionsQuery.eq('id', specificConnectionId);
    }

    const { data: connections, error: connError } = await connectionsQuery;

    if (connError || !connections || connections.length === 0) {
      return NextResponse.json({
        error: 'No Clover merchants connected. Please connect your Clover account first.'
      }, { status: 400 });
    }

    const allResults = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };
    let totalItemsFound = 0;
    const merchantSummaries: string[] = [];

    // Sync from each connected merchant
    for (const conn of connections as CloverConnectionRow[]) {
      try {
        const cloverItems = await fetchCloverInventoryItems({
          merchantId: conn.merchant_id,
          accessToken: conn.access_token,
          environment: conn.environment as 'us' | 'eu',
        });

        totalItemsFound += cloverItems.length;

        if (cloverItems.length === 0) {
          merchantSummaries.push(`${conn.label}: No items found`);
          continue;
        }

        // Tag items with the merchant ID so we can track which store they came from
        const taggedItems = cloverItems.map(item => ({
          ...item,
          clover_merchant_id: conn.merchant_id,
        }));

        const syncResult = await syncInventoryItems({
          orgId,
          source: 'clover',
          items: taggedItems,
          enableAiLabeling,
        });

        allResults.created += syncResult.results.created;
        allResults.updated += syncResult.results.updated;
        allResults.failed += syncResult.results.failed;
        allResults.errors.push(...syncResult.results.errors);
        merchantSummaries.push(`${conn.label} (${conn.merchant_id}): ${cloverItems.length} items`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        allResults.failed++;
        allResults.errors.push(`${conn.label}: ${msg}`);
        merchantSummaries.push(`${conn.label}: Failed - ${msg}`);
      }
    }

    return NextResponse.json({
      success: allResults.failed === 0 || allResults.created > 0 || allResults.updated > 0,
      summary: `Synced ${connections.length} merchant(s). Created: ${allResults.created}, Updated: ${allResults.updated}, Failed: ${allResults.failed}`,
      results: allResults,
      itemsFound: totalItemsFound,
      merchants: merchantSummaries,
    });
  } catch (error) {
    console.error('Clover sync error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
