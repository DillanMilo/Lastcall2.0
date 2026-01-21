import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { testCloverConnection } from '@/lib/integrations/clover';
import { checkIntegrationAccess } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/integrations/clover/connect
 * Test and save Clover credentials for an organization
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

    // Use admin client for updating organization
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check tier access
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier, billing_exempt')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const tier = (org.subscription_tier || 'free') as PlanTier;
    const billingExempt = org.billing_exempt === true;
    const integrationCheck = checkIntegrationAccess(tier, 'clover', billingExempt);

    if (!integrationCheck.allowed) {
      return NextResponse.json({
        error: integrationCheck.message || 'Clover integration requires Growth plan or higher'
      }, { status: 403 });
    }

    // Get credentials from request
    const body = await request.json();
    const { merchant_id, access_token, environment = 'us' } = body;

    if (!merchant_id || !access_token) {
      return NextResponse.json({
        error: 'Missing required fields: merchant_id, access_token'
      }, { status: 400 });
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

    // Save credentials
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        clover_merchant_id: merchant_id,
        clover_access_token: access_token,
        clover_connected_at: new Date().toISOString(),
      })
      .eq('id', orgId);

    if (updateError) {
      console.error('Failed to save Clover credentials:', updateError);
      return NextResponse.json({
        error: 'Failed to save connection settings'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Connected to Clover merchant: ${connectionTest.merchantName}`,
      merchantName: connectionTest.merchantName,
    });
  } catch (error) {
    console.error('Clover connect error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/integrations/clover/connect
 * Disconnect Clover integration
 */
export async function DELETE(request: NextRequest) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgId = userData.org_id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        clover_merchant_id: null,
        clover_access_token: null,
        clover_connected_at: null,
      })
      .eq('id', orgId);

    if (updateError) {
      console.error('Failed to disconnect Clover:', updateError);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Clover disconnected' });
  } catch (error) {
    console.error('Clover disconnect error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
