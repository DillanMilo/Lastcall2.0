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
 * This makes LastCall the source of truth.
 *
 * Request body:
 * - item_id: string - The LastCall inventory item ID to push
 * - create_if_missing: boolean - Create the item in Clover if it doesn't exist
 *
 * Or for bulk push:
 * - item_ids: string[] - Array of item IDs to push
 */
export async function POST(request: NextRequest) {
  try {
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

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's org
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgId = userData.org_id;

    // Use admin client
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get org and Clover credentials
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier, billing_exempt, clover_merchant_id, clover_access_token')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
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

    // Check if Clover is connected
    if (!org.clover_merchant_id || !org.clover_access_token) {
      return NextResponse.json({
        error: 'Clover is not connected. Please connect your Clover account first.'
      }, { status: 400 });
    }

    const body = await request.json();
    const { item_id, item_ids, create_if_missing = false } = body;

    // Support single item or bulk
    const itemIdsToProcess = item_ids || (item_id ? [item_id] : []);

    if (itemIdsToProcess.length === 0) {
      return NextResponse.json({ error: 'No item IDs provided' }, { status: 400 });
    }

    // Fetch items from our inventory
    const { data: items, error: itemsError } = await adminClient
      .from('inventory_items')
      .select('id, name, sku, quantity, clover_item_id')
      .eq('org_id', orgId)
      .in('id', itemIdsToProcess);

    if (itemsError) {
      console.error('Failed to fetch inventory items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items found' }, { status: 404 });
    }

    const results = {
      updated: 0,
      created: 0,
      failed: 0,
      errors: [] as string[],
    };

    const credentials = {
      merchantId: org.clover_merchant_id,
      accessToken: org.clover_access_token,
    };

    for (const item of items) {
      try {
        if (item.clover_item_id) {
          // Item exists in Clover - update inventory
          const updateResult = await updateCloverInventory(
            credentials,
            item.clover_item_id,
            item.quantity
          );

          if (updateResult.success) {
            results.updated++;
          } else {
            results.failed++;
            results.errors.push(`${item.name}: ${updateResult.error}`);
          }
        } else if (create_if_missing) {
          // Create item in Clover
          const createResult = await createCloverItem(credentials, {
            name: item.name,
            sku: item.sku,
            stockCount: item.quantity,
          });

          if (createResult.success && createResult.itemId) {
            // Save Clover item ID back to our database
            await adminClient
              .from('inventory_items')
              .update({ clover_item_id: createResult.itemId })
              .eq('id', item.id);

            results.created++;
          } else {
            results.failed++;
            results.errors.push(`${item.name}: ${createResult.error}`);
          }
        } else {
          // Item doesn't exist in Clover and we're not creating
          results.failed++;
          results.errors.push(`${item.name}: No Clover item ID and create_if_missing is false`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
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
