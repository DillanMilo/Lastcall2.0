import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { fetchBigCommerceOrders } from '@/lib/integrations/bigcommerce';
import { decryptToken } from '@/lib/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/integrations/bigcommerce/orders
 * Fetch sales/order data from BigCommerce for a date range (read-only).
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

    // Get BigCommerce credentials
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return jsonResponse({
        success: true,
        hasData: false,
        message: 'Organization not found',
        summary: null,
      });
    }

    if (!org.bigcommerce_store_hash || !org.bigcommerce_client_id || !org.bigcommerce_access_token) {
      return jsonResponse({
        success: true,
        hasData: false,
        message: 'BigCommerce is not connected',
        summary: null,
      });
    }

    const summary = await fetchBigCommerceOrders(
      {
        storeHash: org.bigcommerce_store_hash,
        clientId: org.bigcommerce_client_id,
        accessToken: decryptToken(org.bigcommerce_access_token),
      },
      startDate,
      endDate,
    );

    return jsonResponse({
      success: true,
      hasData: summary.totalOrders > 0,
      summary: {
        ...summary,
        source: 'bigcommerce',
      },
      dateRange: { start: start_date, end: end_date },
    });
  } catch (error) {
    console.error('BigCommerce orders error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
