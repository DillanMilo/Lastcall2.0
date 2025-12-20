import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface CreateProductRequest {
  org_id: string;
  name: string;
  sku?: string;
  quantity: number;
  invoice?: string;
  expiration_date?: string;
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
 * POST /api/integrations/bigcommerce/create-product
 *
 * Creates a new product in BigCommerce from Last Call.
 * This is a one-way sync - products added in Last Call are pushed to BigCommerce.
 *
 * Body: {
 *   org_id: string,
 *   name: string,
 *   sku?: string,
 *   quantity: number,
 *   invoice?: string,
 *   expiration_date?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateProductRequest = await request.json();
    const { org_id, name, sku, quantity, invoice, expiration_date } = body;

    // Validate required fields
    if (!org_id || !name) {
      return NextResponse.json(
        { error: 'org_id and name are required' },
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

    // Get organization's BigCommerce credentials
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token')
      .eq('id', org_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!org.bigcommerce_store_hash || !org.bigcommerce_client_id || !org.bigcommerce_access_token) {
      return NextResponse.json(
        { error: 'BigCommerce is not connected. Please configure your credentials in Settings.' },
        { status: 400 }
      );
    }

    const { bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token } = org;

    // Check if product with this SKU already exists
    if (sku) {
      const searchUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products?sku=${encodeURIComponent(sku)}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': bigcommerce_access_token,
          'X-Auth-Client': bigcommerce_client_id,
        },
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          // Product exists - update inventory instead
          const existingProduct = searchData.data[0];
          const productId = existingProduct.id;

          // Update inventory level
          const inventoryUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products/${productId}`;
          const updateResponse = await fetch(inventoryUrl, {
            method: 'PUT',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Auth-Token': bigcommerce_access_token,
              'X-Auth-Client': bigcommerce_client_id,
            },
            body: JSON.stringify({
              inventory_level: quantity,
            }),
          });

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            return NextResponse.json(
              { error: 'Failed to update existing product inventory', details: errorText },
              { status: 400 }
            );
          }

          return NextResponse.json({
            success: true,
            action: 'updated',
            message: `Updated inventory for existing product "${name}" to ${quantity} units`,
            bigcommerce_product_id: productId,
          });
        }
      }
    }

    // Build custom fields for invoice and expiry date
    const customFields = [];
    if (invoice) {
      customFields.push({
        name: 'Invoice/Batch',
        value: invoice,
      });
    }
    if (expiration_date) {
      customFields.push({
        name: 'Expiry Date',
        value: expiration_date,
      });
    }

    // Create new product in BigCommerce
    const createUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products`;
    const productData: Record<string, unknown> = {
      name,
      type: 'physical',
      weight: 0, // Required field, default to 0
      price: 0, // Default price to 0 (user didn't want price field)
      inventory_level: quantity,
      inventory_tracking: 'product',
      is_visible: true,
    };

    // Add SKU if provided
    if (sku) {
      productData.sku = sku;
    }

    // Add custom fields if any
    if (customFields.length > 0) {
      productData.custom_fields = customFields;
    }

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Auth-Token': bigcommerce_access_token,
        'X-Auth-Client': bigcommerce_client_id,
      },
      body: JSON.stringify(productData),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('BigCommerce create product error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create product in BigCommerce', details: errorText },
        { status: 400 }
      );
    }

    const createdProduct = await createResponse.json();
    const bigcommerceProductId = createdProduct.data?.id;

    return NextResponse.json({
      success: true,
      action: 'created',
      message: `Product "${name}" created in BigCommerce with ${quantity} units`,
      bigcommerce_product_id: bigcommerceProductId,
    });
  } catch (error) {
    console.error('Error creating product in BigCommerce:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create product', details: errorMessage },
      { status: 500 }
    );
  }
}
