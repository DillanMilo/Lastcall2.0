import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { checkIntegrationAccess } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';
import { encryptToken } from '@/lib/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface ConnectRequest {
  org_id: string;
  store_hash: string;
  client_id: string;
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
 * POST /api/integrations/bigcommerce/connect
 *
 * Test and save BigCommerce credentials for an organization.
 * Tests the connection before saving to ensure credentials are valid.
 * Verifies user belongs to the organization before allowing changes.
 */
export async function POST(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const body: ConnectRequest = await request.json();

    const { org_id, store_hash, client_id, access_token } = body;

    // Validate required fields
    if (!org_id || !store_hash || !client_id || !access_token) {
      return jsonResponse(
        { error: 'All fields are required: org_id, store_hash, client_id, access_token' },
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

    // Check organization tier for BigCommerce integration access
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
    const integrationCheck = checkIntegrationAccess(tier, 'bigcommerce');

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

    // Test the BigCommerce connection using the catalog endpoint (more reliable)
    const testUrl = `https://api.bigcommerce.com/stores/${store_hash}/v3/catalog/products?limit=1`;
    const testResponse = await fetch(testUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Auth-Token': access_token,
        'X-Auth-Client': client_id,
      },
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return jsonResponse(
        {
          success: false,
          error: 'Connection test failed',
          details: `BigCommerce API error (${testResponse.status}): ${errorText || testResponse.statusText}`,
        },
        { status: 400 }
      );
    }

    const catalogData = await testResponse.json();
    const productCount = catalogData?.meta?.pagination?.total || 0;

    // Save credentials to organization (encrypt access token)
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        bigcommerce_store_hash: store_hash,
        bigcommerce_client_id: client_id,
        bigcommerce_access_token: encryptToken(access_token),
        bigcommerce_connected_at: new Date().toISOString(),
      })
      .eq('id', org_id);

    if (updateError) {
      console.error('Error saving BigCommerce credentials:', updateError);
      return jsonResponse(
        { error: 'Failed to save credentials', details: updateError.message },
        { status: 500 }
      );
    }

    return jsonResponse({
      success: true,
      store_info: {
        name: `Store ${store_hash}`,
        product_count: productCount,
      },
      message: `BigCommerce connected successfully! Found ${productCount} products.`,
    });
  } catch (error) {
    console.error('Error in BigCommerce connect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Connection failed', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/bigcommerce/connect
 *
 * Disconnect BigCommerce from an organization.
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
        bigcommerce_store_hash: null,
        bigcommerce_client_id: null,
        bigcommerce_access_token: null,
        bigcommerce_connected_at: null,
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
      message: 'BigCommerce disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting BigCommerce:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
