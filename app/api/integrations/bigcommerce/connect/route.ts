import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface ConnectRequest {
  org_id: string;
  store_hash: string;
  client_id: string;
  access_token: string;
}

/**
 * Verify user is authenticated and belongs to the specified organization
 */
async function verifyUserOrg(request: NextRequest, orgId: string): Promise<{ valid: boolean; error?: string }> {
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
    return { valid: false, error: 'Unauthorized' };
  }

  // Verify user belongs to this organization
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData || userData.org_id !== orgId) {
    return { valid: false, error: 'Access denied - you do not belong to this organization' };
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
    const body: ConnectRequest = await request.json();
    
    const { org_id, store_hash, client_id, access_token } = body;
    
    // Validate required fields
    if (!org_id || !store_hash || !client_id || !access_token) {
      return NextResponse.json(
        { error: 'All fields are required: org_id, store_hash, client_id, access_token' },
        { status: 400 }
      );
    }

    // Verify user belongs to this organization
    const authCheck = await verifyUserOrg(request, org_id);
    if (!authCheck.valid) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: 403 }
      );
    }
    
    // Test the BigCommerce connection
    const testUrl = `https://api.bigcommerce.com/stores/${store_hash}/v3/store`;
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
      return NextResponse.json(
        {
          success: false,
          error: 'Connection test failed',
          details: `BigCommerce API error (${testResponse.status}): ${errorText || testResponse.statusText}`,
        },
        { status: 400 }
      );
    }
    
    const storeInfo = await testResponse.json();
    
    // Save credentials to organization
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set' },
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
        bigcommerce_store_hash: store_hash,
        bigcommerce_client_id: client_id,
        bigcommerce_access_token: access_token,
        bigcommerce_connected_at: new Date().toISOString(),
      })
      .eq('id', org_id);
    
    if (updateError) {
      console.error('Error saving BigCommerce credentials:', updateError);
      return NextResponse.json(
        { error: 'Failed to save credentials', details: updateError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      store_info: {
        name: storeInfo.data?.name,
        domain: storeInfo.data?.domain,
      },
      message: 'BigCommerce connected successfully!',
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
    const { searchParams } = new URL(request.url);
    const org_id = searchParams.get('org_id');
    
    if (!org_id) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    // Verify user belongs to this organization
    const authCheck = await verifyUserOrg(request, org_id);
    if (!authCheck.valid) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: 403 }
      );
    }
    
    if (!serviceRoleKey) {
      return NextResponse.json(
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
      return NextResponse.json(
        { error: 'Failed to disconnect', details: updateError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
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

