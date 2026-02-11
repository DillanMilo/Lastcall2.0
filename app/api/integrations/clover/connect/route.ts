import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { testCloverConnection } from '@/lib/integrations/clover';
import { checkIntegrationAccess } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function createAuthClient(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return request.cookies.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) { response.cookies.set({ name, value, ...options }); },
      remove(name: string, options: CookieOptions) { response.cookies.set({ name, value: '', ...options }); },
    },
  });
  return supabase;
}

/**
 * GET /api/integrations/clover/connect
 * List all Clover connections for the current org
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
    if (!userData?.org_id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: connections, error } = await adminClient
      .from('clover_connections')
      .select('id, merchant_id, label, environment, merchant_name, connected_at')
      .eq('org_id', userData.org_id)
      .order('connected_at');

    if (error) {
      console.error('Failed to fetch Clover connections:', error);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    return NextResponse.json({ connections: connections || [] });
  } catch (error) {
    console.error('Clover list connections error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/integrations/clover/connect
 * Add a new Clover merchant connection
 *
 * Request body:
 * - merchant_id: string
 * - access_token: string
 * - label: string (e.g., "Physical Store", "Online Store")
 * - environment: "us" | "eu" (default: "us")
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthClient(request);
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

    const body = await request.json();
    const { merchant_id, access_token, label = 'Store', environment = 'us' } = body;

    if (!merchant_id || !access_token) {
      return NextResponse.json({ error: 'Missing required fields: merchant_id, access_token' }, { status: 400 });
    }

    // Check if this merchant is already connected
    const { data: existing } = await adminClient
      .from('clover_connections')
      .select('id')
      .eq('org_id', orgId)
      .eq('merchant_id', merchant_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This Clover merchant is already connected.' }, { status: 409 });
    }

    // Test the connection
    const connectionTest = await testCloverConnection({
      merchantId: merchant_id,
      accessToken: access_token,
      environment,
    });

    if (!connectionTest.success) {
      return NextResponse.json({
        error: connectionTest.error || 'Failed to connect to Clover'
      }, { status: 400 });
    }

    // Save connection
    const { error: insertError } = await adminClient
      .from('clover_connections')
      .insert({
        org_id: orgId,
        merchant_id,
        access_token,
        label,
        environment,
        merchant_name: connectionTest.merchantName || null,
        connected_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to save Clover connection:', insertError);
      return NextResponse.json({ error: 'Failed to save connection settings' }, { status: 500 });
    }

    // Also update legacy org columns with the first/latest connection for backward compat
    await adminClient
      .from('organizations')
      .update({
        clover_merchant_id: merchant_id,
        clover_access_token: access_token,
        clover_connected_at: new Date().toISOString(),
      })
      .eq('id', orgId);

    return NextResponse.json({
      success: true,
      message: `Connected to Clover merchant: ${connectionTest.merchantName}`,
      merchantName: connectionTest.merchantName,
    });
  } catch (error) {
    console.error('Clover connect error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/integrations/clover/connect
 * Disconnect a specific Clover merchant or all merchants
 *
 * Query params:
 * - connection_id: string (optional - specific connection to remove)
 * If no connection_id, disconnects ALL Clover connections
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAuthClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
    if (!userData?.org_id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const orgId = userData.org_id;
    const connectionId = request.nextUrl.searchParams.get('connection_id');

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (connectionId) {
      // Delete specific connection
      const { error } = await adminClient
        .from('clover_connections')
        .delete()
        .eq('id', connectionId)
        .eq('org_id', orgId);

      if (error) {
        console.error('Failed to disconnect Clover merchant:', error);
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
      }
    } else {
      // Delete all connections
      const { error } = await adminClient
        .from('clover_connections')
        .delete()
        .eq('org_id', orgId);

      if (error) {
        console.error('Failed to disconnect all Clover merchants:', error);
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
      }
    }

    // Check if any connections remain, update legacy org columns
    const { data: remaining } = await adminClient
      .from('clover_connections')
      .select('merchant_id, access_token, connected_at')
      .eq('org_id', orgId)
      .order('connected_at')
      .limit(1);

    if (remaining && remaining.length > 0) {
      await adminClient
        .from('organizations')
        .update({
          clover_merchant_id: remaining[0].merchant_id,
          clover_access_token: remaining[0].access_token,
          clover_connected_at: remaining[0].connected_at,
        })
        .eq('id', orgId);
    } else {
      await adminClient
        .from('organizations')
        .update({
          clover_merchant_id: null,
          clover_access_token: null,
          clover_connected_at: null,
        })
        .eq('id', orgId);
    }

    return NextResponse.json({
      success: true,
      message: connectionId ? 'Clover merchant disconnected' : 'All Clover connections disconnected',
    });
  } catch (error) {
    console.error('Clover disconnect error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
