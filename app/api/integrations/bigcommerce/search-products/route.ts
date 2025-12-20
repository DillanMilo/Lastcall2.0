import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface BigCommerceProduct {
  id: number;
  name: string;
  sku: string;
  inventory_level: number;
  price: number;
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

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData || userData.org_id !== orgId) {
    return { valid: false, error: 'Access denied' };
  }

  return { valid: true };
}

/**
 * GET /api/integrations/bigcommerce/search-products
 *
 * Search BigCommerce products by name for autocomplete.
 *
 * Query params:
 *   org_id: string - Organization ID
 *   q: string - Search query (product name)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const query = searchParams.get('q');

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 });
    }

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [] });
    }

    // Verify user belongs to this organization
    const authCheck = await verifyUserOrg(request, orgId);
    if (!authCheck.valid) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get organization's BigCommerce credentials
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.bigcommerce_store_hash || !org.bigcommerce_access_token) {
      return NextResponse.json({ products: [], message: 'BigCommerce not connected' });
    }

    const { bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token } = org;

    // Search BigCommerce products by name
    const searchUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products?keyword=${encodeURIComponent(query)}&limit=10&include_fields=id,name,sku,inventory_level,price`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Auth-Token': bigcommerce_access_token,
        'X-Auth-Client': bigcommerce_client_id,
      },
    });

    if (!searchResponse.ok) {
      console.error('BigCommerce search error:', await searchResponse.text());
      return NextResponse.json({ products: [], error: 'Search failed' });
    }

    const data = await searchResponse.json();
    const products: BigCommerceProduct[] = data.data || [];

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        inventory_level: p.inventory_level || 0,
        price: p.price || 0,
      })),
    });
  } catch (error) {
    console.error('Error searching BigCommerce products:', error);
    return NextResponse.json({ products: [], error: 'Search failed' }, { status: 500 });
  }
}
