import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { updateCloverInventory, createCloverItem } from '@/lib/integrations/clover';
import { checkIntegrationAccess } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/integrations/clover/push
 * Push inventory updates FROM LastCall TO Clover
 *
 * For multi-merchant, each item knows which merchant it belongs to via clover_merchant_id.
 * The push looks up the correct credentials from clover_connections.
 *
 * Request body:
 * - item_id: string - The LastCall inventory item ID to push
 * - item_ids: string[] - Array of item IDs to push (bulk)
 * - create_if_missing: boolean - Create the item in Clover if it doesn't exist
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

    // Get org details
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier, billing_exempt, thrive_validation_mode')
      .eq('id', orgId)
      .single();

    if (orgError || !org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    // Block writes when Thrive validation mode is active
    if (org.thrive_validation_mode === true) {
      return NextResponse.json({
        error: 'Clover push is disabled during Thrive validation mode. LastCallIQ is running in read-only mode to safely capture data alongside Thrive without interfering.',
        validation_mode: true,
      }, { status: 403 });
    }

    // Check tier access
    const tier = (org.subscription_tier || 'free') as PlanTier;
    const billingExempt = org.billing_exempt === true;
    const integrationCheck = checkIntegrationAccess(tier, 'clover', billingExempt);

    if (!integrationCheck.allowed) {
      return NextResponse.json({
        error: integrationCheck.message || 'Clover integration requires Growth plan or higher'
      }, { status: 403 });
    }

    // Get all Clover connections for this org
    const { data: connections } = await adminClient
      .from('clover_connections')
      .select('merchant_id, access_token')
      .eq('org_id', orgId);

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        error: 'No Clover merchants connected. Please connect your Clover account first.'
      }, { status: 400 });
    }

    // Build a lookup map: merchant_id -> credentials
    const credentialsMap = new Map<string, { merchantId: string; accessToken: string }>();
    for (const conn of connections) {
      credentialsMap.set(conn.merchant_id, {
        merchantId: conn.merchant_id,
        accessToken: conn.access_token,
      });
    }

    const body = await request.json();
    const { item_id, item_ids, create_if_missing = false } = body;
    const itemIdsToProcess: string[] = item_ids || (item_id ? [item_id] : []);

    if (itemIdsToProcess.length === 0) {
      return NextResponse.json({ error: 'No item IDs provided' }, { status: 400 });
    }

    // Fetch items, including which merchant they belong to
    const { data: items, error: itemsError } = await adminClient
      .from('inventory_items')
      .select('id, name, sku, quantity, clover_item_id, clover_merchant_id')
      .eq('org_id', orgId)
      .in('id', itemIdsToProcess);

    if (itemsError) {
      console.error('Failed to fetch inventory items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items found' }, { status: 404 });
    }

    const results = { updated: 0, created: 0, failed: 0, errors: [] as string[] };

    for (const item of items) {
      try {
        // Find the right credentials for this item's merchant
        let credentials = item.clover_merchant_id
          ? credentialsMap.get(item.clover_merchant_id)
          : undefined;

        // Fallback to first connection if item doesn't have a merchant ID
        if (!credentials) {
          credentials = credentialsMap.values().next().value;
        }

        if (!credentials) {
          results.failed++;
          results.errors.push(`${item.name}: No Clover credentials found`);
          continue;
        }

        if (item.clover_item_id) {
          const updateResult = await updateCloverInventory(credentials, item.clover_item_id, item.quantity);

          if (updateResult.success) {
            results.updated++;
          } else {
            results.failed++;
            results.errors.push(`${item.name}: ${updateResult.error}`);
          }
        } else if (create_if_missing) {
          const createResult = await createCloverItem(credentials, {
            name: item.name,
            sku: item.sku,
            stockCount: item.quantity,
          });

          if (createResult.success && createResult.itemId) {
            await adminClient
              .from('inventory_items')
              .update({
                clover_item_id: createResult.itemId,
                clover_merchant_id: credentials.merchantId,
              })
              .eq('id', item.id);

            results.created++;
          } else {
            results.failed++;
            results.errors.push(`${item.name}: ${createResult.error}`);
          }
        } else {
          results.failed++;
          results.errors.push(`${item.name}: No Clover item ID and create_if_missing is false`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: results.failed === 0,
      message: `Updated: ${results.updated}, Created: ${results.created}, Failed: ${results.failed}`,
      results,
    });
  } catch (error) {
    console.error('Clover push error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
