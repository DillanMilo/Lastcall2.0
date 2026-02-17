import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { checkIntegrationAccess } from '@/lib/stripe/tier-limits';
import { testShopifyConnection, getShopifyProductCount, normalizeStoreDomain } from '@/lib/integrations/shopify';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface ConnectRequest {
  org_id: string;
  store_domain: string;
  access_token: string;
}

/**
 * Verify user is authenticated, belongs to the specified organization, and is an admin
 */
async function verifyUserOrgAdmin(request: NextRequest, orgId: string): Promise<{ valid: boolean; error?: string; status?: number }> {
  const { supabase } = createRouteHandlerClient(request);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { valid: false, error: 'Unauthorized', status: 401 };
  }

  // Verify user belongs to this organization and is an admin
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('id', user.id)
    .single();

  if (userError || !userData || userData.org_id !== orgId) {
    return { valid: false, error: 'Access denied - you do not belong to this organization', status: 403 };
  }

  // Only owners and admins can manage integrations
  if (userData.role !== 'owner' && userData.role !== 'admin') {
    return { valid: false, error: 'Only owners and admins can manage integrations', status: 403 };
  }

  return { valid: true };
}

/**
 * POST /api/integrations/shopify/connect
 *
 * Test and save Shopify credentials for an organization.
 * Tests the connection before saving to ensure credentials are valid.
 * Verifies user belongs to the organization before allowing changes.
 */
export async function POST(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const body: ConnectRequest = await request.json();

    const { org_id, store_domain, access_token } = body;

    // Validate required fields
    if (!org_id || !store_domain || !access_token) {
      return jsonResponse(
        { error: 'All fields are required: org_id, store_domain, access_token' },
        { status: 400 }
      );
    }

    // Verify user belongs to this organization
    const authCheck = await verifyUserOrgAdmin(request, org_id);
    if (!authCheck.valid) {
      return jsonResponse(
        { error: authCheck.error },
        { status: 403 }
      );
    }

    // Check organization tier for Shopify integration access
    if (!serviceRoleKey) {
      return jsonResponse(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set' },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: orgData, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier')
      .eq('id', org_id)
      .single();

    if (orgError || !orgData) {
      return jsonResponse(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const tier = (orgData.subscription_tier || 'free') as PlanTier;
    const integrationCheck = checkIntegrationAccess(tier, 'shopify');

    if (!integrationCheck.allowed) {
      return jsonResponse(
        {
          error: 'Upgrade required',
          message: integrationCheck.message,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // Normalize the store domain
    const normalizedDomain = normalizeStoreDomain(store_domain);

    // Test the Shopify connection
    const connectionTest = await testShopifyConnection({
      storeDomain: normalizedDomain,
      accessToken: access_token,
    });

    if (!connectionTest.success) {
      return jsonResponse(
        {
          success: false,
          error: 'Connection test failed',
          details: connectionTest.error || 'Failed to connect to Shopify store',
        },
        { status: 400 }
      );
    }

    // Get product count
    let productCount = 0;
    try {
      productCount = await getShopifyProductCount({
        storeDomain: normalizedDomain,
        accessToken: access_token,
      });
    } catch {
      // Non-critical, continue without count
    }

    // Save credentials to organization
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        shopify_store_domain: normalizedDomain,
        shopify_access_token: access_token,
        shopify_connected_at: new Date().toISOString(),
      })
      .eq('id', org_id);

    if (updateError) {
      console.error('Error saving Shopify credentials:', updateError);
      return jsonResponse(
        { error: 'Failed to save credentials', details: updateError.message },
        { status: 500 }
      );
    }

    return jsonResponse({
      success: true,
      store_info: {
        name: connectionTest.shopName || normalizedDomain,
        domain: normalizedDomain,
        product_count: productCount,
      },
      message: `Shopify connected successfully! Found ${productCount} products.`,
    });
  } catch (error) {
    console.error('Error in Shopify connect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Connection failed', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/shopify/connect
 *
 * Disconnect Shopify from an organization.
 * Verifies user belongs to the organization before allowing changes.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const { searchParams } = new URL(request.url);
    const org_id = searchParams.get('org_id');

    if (!org_id) {
      return jsonResponse(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    // Verify user belongs to this organization
    const authCheck = await verifyUserOrgAdmin(request, org_id);
    if (!authCheck.valid) {
      return jsonResponse(
        { error: authCheck.error },
        { status: 403 }
      );
    }

    if (!serviceRoleKey) {
      return jsonResponse(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        shopify_store_domain: null,
        shopify_access_token: null,
        shopify_connected_at: null,
      })
      .eq('id', org_id);

    if (updateError) {
      return jsonResponse(
        { error: 'Failed to disconnect', details: updateError.message },
        { status: 500 }
      );
    }

    return jsonResponse({
      success: true,
      message: 'Shopify disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Shopify:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
