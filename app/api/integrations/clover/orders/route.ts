import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { fetchCloverOrders } from '@/lib/integrations/clover';
import { decryptToken } from '@/lib/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface CloverConnectionRow {
  id: string;
  merchant_id: string;
  access_token: string;
  label: string;
  environment: string;
}

/**
 * POST /api/integrations/clover/orders
 * Fetch sales/order data from all connected Clover merchants for a date range (read-only).
 *
 * Body: {
 *   org_id: string,
 *   start_date: string (ISO),
 *   end_date: string (ISO)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, jsonResponse } = createRouteHandlerClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
    if (!userData?.org_id) return jsonResponse({ error: 'Organization not found' }, { status: 404 });

    const body = await request.json();
    const { start_date, end_date } = body;
    const orgId = body.org_id || userData.org_id;

    if (orgId !== userData.org_id) {
      return jsonResponse({ error: 'Access denied' }, { status: 403 });
    }

    if (!start_date || !end_date) {
      return jsonResponse({ error: 'start_date and end_date are required (ISO format)' }, { status: 400 });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return jsonResponse({ error: 'Invalid date format. Use ISO 8601.' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get all Clover connections
    const { data: connections, error: connError } = await adminClient
      .from('clover_connections')
      .select('id, merchant_id, access_token, label, environment')
      .eq('org_id', orgId);

    if (connError || !connections || connections.length === 0) {
      return jsonResponse({
        success: true,
        hasData: false,
        message: 'No Clover merchants connected',
        summary: null,
      });
    }

    // Fetch orders from each merchant and combine
    let combinedRevenue = 0;
    let combinedOrders = 0;
    const combinedItems = new Map<string, { name: string; cloverItemId?: string; unitsSold: number; revenue: number }>();
    const merchantResults: { label: string; orders: number; revenue: number }[] = [];

    for (const conn of connections as CloverConnectionRow[]) {
      try {
        const summary = await fetchCloverOrders(
          {
            merchantId: conn.merchant_id,
            accessToken: decryptToken(conn.access_token),
            environment: conn.environment as 'us' | 'eu',
          },
          startDate,
          endDate,
        );

        combinedRevenue += summary.totalRevenue;
        combinedOrders += summary.totalOrders;
        merchantResults.push({ label: conn.label, orders: summary.totalOrders, revenue: summary.totalRevenue });

        for (const item of summary.itemBreakdown) {
          const key = item.cloverItemId || item.name;
          const existing = combinedItems.get(key);
          if (existing) {
            existing.unitsSold += item.unitsSold;
            existing.revenue += item.revenue;
          } else {
            combinedItems.set(key, { ...item });
          }
        }
      } catch (err) {
        console.error(`Failed to fetch orders from ${conn.label}:`, err);
        merchantResults.push({ label: conn.label, orders: 0, revenue: 0 });
      }
    }

    const itemBreakdown = Array.from(combinedItems.values())
      .sort((a, b) => b.revenue - a.revenue);

    return jsonResponse({
      success: true,
      hasData: combinedOrders > 0,
      summary: {
        totalRevenue: Math.round(combinedRevenue * 100) / 100,
        totalOrders: combinedOrders,
        avgOrderValue: combinedOrders > 0
          ? Math.round((combinedRevenue / combinedOrders) * 100) / 100
          : 0,
        itemBreakdown,
        source: 'clover',
      },
      merchants: merchantResults,
      dateRange: { start: start_date, end: end_date },
    });
  } catch (error) {
    console.error('Clover orders error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
