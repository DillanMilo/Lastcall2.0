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

/**
 * POST /api/integrations/clover/sync
 * Pull inventory items from Clover and sync to LastCall
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

    // Use admin client for organization data
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

    // Get optional settings from request body
    const body = await request.json().catch(() => ({}));
    const enableAiLabeling = body.enableAiLabeling === true;

    // Fetch items from Clover
    const cloverItems = await fetchCloverInventoryItems({
      merchantId: org.clover_merchant_id,
      accessToken: org.clover_access_token,
    });

    if (cloverItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items found in Clover',
        results: { created: 0, updated: 0, failed: 0, errors: [] },
      });
    }

    // Sync to LastCall
    const syncResult = await syncInventoryItems({
      orgId,
      source: 'clover',
      items: cloverItems,
      enableAiLabeling,
    });

    return NextResponse.json({
      success: syncResult.success,
      message: syncResult.summary,
      results: syncResult.results,
      itemsFound: cloverItems.length,
    });
  } catch (error) {
    console.error('Clover sync error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
