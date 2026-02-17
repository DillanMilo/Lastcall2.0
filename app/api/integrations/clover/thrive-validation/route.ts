import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';
import { checkIntegrationAccess } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface HistoryRecord {
  id: string;
  item_name: string;
  sku: string | null;
  previous_quantity: number;
  new_quantity: number;
  quantity_change: number;
  change_type: string;
  source: string | null;
  created_at: string;
}

/**
 * GET /api/integrations/clover/thrive-validation
 * Get Thrive validation report - compare what LastCallIQ has captured
 *
 * Returns:
 * - Current validation mode status
 * - Total items tracked
 * - Webhook events received during validation period
 * - Inventory history summary since validation started
 * - Item-level snapshot for comparison with Thrive
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, jsonResponse } = createRouteHandlerClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return jsonResponse({ error: 'Organization not found' }, { status: 404 });
    }

    const orgId = userData.org_id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get org details
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier, billing_exempt, thrive_validation_mode, thrive_validation_started_at, thrive_validation_ended_at')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Organization not found' }, { status: 404 });
    }

    const tier = (org.subscription_tier || 'free') as PlanTier;
    const billingExempt = org.billing_exempt === true;
    const integrationCheck = checkIntegrationAccess(tier, 'clover', billingExempt);

    if (!integrationCheck.allowed) {
      return jsonResponse({
        error: integrationCheck.message || 'Clover integration requires Growth plan or higher'
      }, { status: 403 });
    }

    // Get all Clover connections for this org
    const { data: connections } = await adminClient
      .from('clover_connections')
      .select('id, merchant_id, label, merchant_name, connected_at')
      .eq('org_id', orgId)
      .order('connected_at');

    // Get all Clover-linked inventory items with current quantities
    const { data: items, error: itemsError } = await adminClient
      .from('inventory_items')
      .select('id, name, sku, quantity, clover_item_id, clover_merchant_id, category, ai_label, last_restock, created_at')
      .eq('org_id', orgId)
      .not('clover_item_id', 'is', null)
      .order('name');

    if (itemsError) {
      console.error('Failed to fetch inventory items:', itemsError);
      return jsonResponse({ error: 'Failed to fetch items' }, { status: 500 });
    }

    // Get inventory history since validation started (or last 30 days if no validation date)
    const sinceDate = org.thrive_validation_started_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: history } = await adminClient
      .from('inventory_history')
      .select('id, item_name, sku, previous_quantity, new_quantity, quantity_change, change_type, source, created_at')
      .eq('org_id', orgId)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(500);

    // Count webhook events vs sync events
    const historyRecords: HistoryRecord[] = (history || []) as HistoryRecord[];
    const webhookEvents = historyRecords.filter(h => h.source?.includes('clover') && h.change_type === 'webhook');
    const syncEvents = historyRecords.filter(h => h.source === 'clover' && h.change_type === 'sync');
    const validationEvents = historyRecords.filter(h => h.change_type === 'thrive_validation');

    // Calculate summary stats
    const totalSalesDecrement = historyRecords
      .filter(h => h.quantity_change < 0)
      .reduce((sum: number, h) => sum + Math.abs(h.quantity_change), 0);

    const totalRestocks = historyRecords
      .filter(h => h.quantity_change > 0)
      .reduce((sum: number, h) => sum + h.quantity_change, 0);

    return jsonResponse({
      validation_status: {
        active: org.thrive_validation_mode === true,
        started_at: org.thrive_validation_started_at || null,
        ended_at: org.thrive_validation_ended_at || null,
        clover_connected: (connections?.length || 0) > 0,
        merchants_connected: connections?.length || 0,
        merchants: (connections || []).map(c => ({
          merchant_id: c.merchant_id,
          label: c.label,
          merchant_name: c.merchant_name,
          connected_at: c.connected_at,
        })),
      },
      summary: {
        total_clover_items: items?.length || 0,
        total_history_events: historyRecords.length,
        webhook_events: webhookEvents.length,
        sync_events: syncEvents.length,
        validation_events: validationEvents.length,
        total_sales_decrement: totalSalesDecrement,
        total_restocks: totalRestocks,
        tracking_since: sinceDate,
      },
      items: (items || []).map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        current_quantity: item.quantity,
        clover_item_id: item.clover_item_id,
        clover_merchant_id: item.clover_merchant_id,
        category: item.category,
        ai_label: item.ai_label,
        last_restock: item.last_restock,
        created_at: item.created_at,
      })),
      recent_history: historyRecords.slice(0, 100).map(h => ({
        item_name: h.item_name,
        sku: h.sku,
        previous_quantity: h.previous_quantity,
        new_quantity: h.new_quantity,
        change: h.quantity_change,
        type: h.change_type,
        source: h.source,
        timestamp: h.created_at,
      })),
    });
  } catch (error) {
    console.error('Thrive validation report error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST /api/integrations/clover/thrive-validation
 * Toggle Thrive validation mode on/off
 *
 * Request body:
 * - enable: boolean - true to start validation mode, false to end it
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, jsonResponse } = createRouteHandlerClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return jsonResponse({ error: 'Organization not found' }, { status: 404 });
    }

    const orgId = userData.org_id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get org details
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier, billing_exempt, clover_merchant_id, thrive_validation_mode')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Organization not found' }, { status: 404 });
    }

    const tier = (org.subscription_tier || 'free') as PlanTier;
    const billingExempt = org.billing_exempt === true;
    const integrationCheck = checkIntegrationAccess(tier, 'clover', billingExempt);

    if (!integrationCheck.allowed) {
      return jsonResponse({
        error: integrationCheck.message || 'Clover integration requires Growth plan or higher'
      }, { status: 403 });
    }

    // Check for any Clover connections
    const { data: connCheck } = await adminClient
      .from('clover_connections')
      .select('id')
      .eq('org_id', orgId)
      .limit(1);

    if (!connCheck || connCheck.length === 0) {
      return jsonResponse({
        error: 'Clover must be connected before enabling Thrive validation mode.'
      }, { status: 400 });
    }

    const body = await request.json();
    const { enable } = body;

    if (typeof enable !== 'boolean') {
      return jsonResponse({ error: 'Missing required field: enable (boolean)' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (enable) {
      // Start validation mode
      const { error: updateError } = await adminClient
        .from('organizations')
        .update({
          thrive_validation_mode: true,
          thrive_validation_started_at: now,
          thrive_validation_ended_at: null,
        })
        .eq('id', orgId);

      if (updateError) {
        console.error('Failed to enable validation mode:', updateError);
        return jsonResponse({ error: 'Failed to enable validation mode' }, { status: 500 });
      }

      return jsonResponse({
        success: true,
        message: 'Thrive validation mode enabled. LastCallIQ will now capture all Clover data in read-only mode alongside Thrive. Push to Clover is disabled.',
        validation_started_at: now,
      });
    } else {
      // End validation mode
      const { error: updateError } = await adminClient
        .from('organizations')
        .update({
          thrive_validation_mode: false,
          thrive_validation_ended_at: now,
        })
        .eq('id', orgId);

      if (updateError) {
        console.error('Failed to disable validation mode:', updateError);
        return jsonResponse({ error: 'Failed to disable validation mode' }, { status: 500 });
      }

      return jsonResponse({
        success: true,
        message: 'Thrive validation mode ended. LastCallIQ push to Clover is re-enabled. Review the validation report to compare data.',
        validation_ended_at: now,
      });
    }
  } catch (error) {
    console.error('Thrive validation toggle error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
