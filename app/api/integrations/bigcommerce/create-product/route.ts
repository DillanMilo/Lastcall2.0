import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { decryptToken } from '@/lib/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface CreateProductRequest {
  org_id: string;
  name: string;
  sku?: string;
  quantity: number;
  invoice?: string;
  expiration_date?: string;
  bigcommerce_product_id?: number; // If provided, update this product instead of creating new
  action?: 'add' | 'set'; // 'add' adds quantity to existing (default), 'set' sets absolute value
}

/**
 * Verify user is authenticated and belongs to the specified organization
 */
async function verifyUserOrg(request: NextRequest, orgId: string): Promise<{ valid: boolean; error?: string }> {
  const { supabase } = createRouteHandlerClient(request);

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
    const { jsonResponse } = createRouteHandlerClient(request);
    const body: CreateProductRequest = await request.json();
    const { org_id, name, sku, quantity, invoice, expiration_date, bigcommerce_product_id, action = 'add' } = body;

    // Validate required fields
    if (!org_id || !name) {
      return jsonResponse(
        { error: 'org_id and name are required' },
        { status: 400 }
      );
    }

    // Verify user belongs to this organization
    const authCheck = await verifyUserOrg(request, org_id);
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
      return jsonResponse(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!org.bigcommerce_store_hash || !org.bigcommerce_client_id || !org.bigcommerce_access_token) {
      return jsonResponse(
        { error: 'BigCommerce is not connected. Please configure your credentials in Settings.' },
        { status: 400 }
      );
    }

    const bigcommerce_store_hash = org.bigcommerce_store_hash;
    const bigcommerce_client_id = org.bigcommerce_client_id;
    const bigcommerce_access_token = decryptToken(org.bigcommerce_access_token);

    // Helper: standard BigCommerce headers
    const bcHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': bigcommerce_access_token,
      'X-Auth-Client': bigcommerce_client_id,
    };

    // If a BigCommerce product ID is provided, update that product directly
    if (bigcommerce_product_id) {
      // Get product with variants to check inventory_tracking type
      const getProductUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products/${bigcommerce_product_id}?include=variants`;
      const getResponse = await fetch(getProductUrl, { headers: bcHeaders });

      if (!getResponse.ok) {
        return jsonResponse(
          { error: 'Product not found in BigCommerce', details: `Product ID ${bigcommerce_product_id} not found` },
          { status: 404 }
        );
      }

      const productData = await getResponse.json();
      const product = productData.data;
      const inventoryTracking = product?.inventory_tracking || 'product';

      // Handle variant-level inventory tracking
      if (inventoryTracking === 'variant') {
        const variants = product?.variants || [];
        if (variants.length === 0) {
          return jsonResponse(
            { error: 'Product uses variant tracking but has no variants' },
            { status: 400 }
          );
        }

        // Find the matching variant by SKU, or use the first/default variant
        let targetVariant = variants[0];
        if (sku) {
          const skuMatch = variants.find((v: { sku?: string }) => v.sku === sku);
          if (skuMatch) targetVariant = skuMatch;
        }

        const currentInventory = targetVariant.inventory_level || 0;
        const newInventory = action === 'set' ? quantity : currentInventory + quantity;

        const variantUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products/${bigcommerce_product_id}/variants/${targetVariant.id}`;
        const updateResponse = await fetch(variantUrl, {
          method: 'PUT',
          headers: bcHeaders,
          body: JSON.stringify({ inventory_level: newInventory }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          return jsonResponse(
            { error: 'Failed to update variant inventory', details: errorText },
            { status: 400 }
          );
        }

        const message = action === 'set'
          ? `Updated "${name}" inventory to ${newInventory} units (was ${currentInventory})`
          : `Added ${quantity} units to "${name}" (${currentInventory} → ${newInventory})`;

        return jsonResponse({
          success: true,
          action: 'updated',
          message,
          bigcommerce_product_id: bigcommerce_product_id,
          previous_inventory: currentInventory,
          new_inventory: newInventory,
        });
      }

      // Product-level inventory tracking
      const currentInventory = product?.inventory_level || 0;
      const newInventory = action === 'set' ? quantity : currentInventory + quantity;

      const updateUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products/${bigcommerce_product_id}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: bcHeaders,
        body: JSON.stringify({ inventory_level: newInventory }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        return jsonResponse(
          { error: 'Failed to update product inventory', details: errorText },
          { status: 400 }
        );
      }

      const message = action === 'set'
        ? `Updated "${name}" inventory to ${newInventory} units (was ${currentInventory})`
        : `Added ${quantity} units to "${name}" (${currentInventory} → ${newInventory})`;

      return jsonResponse({
        success: true,
        action: 'updated',
        message,
        bigcommerce_product_id: bigcommerce_product_id,
        previous_inventory: currentInventory,
        new_inventory: newInventory,
      });
    }

    // Check if product with this SKU already exists
    if (sku) {
      const searchUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products?sku=${encodeURIComponent(sku)}&include=variants`;
      const searchResponse = await fetch(searchUrl, { headers: bcHeaders });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          const existingProduct = searchData.data[0];
          const productId = existingProduct.id;
          const inventoryTracking = existingProduct.inventory_tracking || 'product';

          // Handle variant-level tracking
          if (inventoryTracking === 'variant') {
            const variants = existingProduct.variants || [];
            let targetVariant = variants[0];
            const skuMatch = variants.find((v: { sku?: string }) => v.sku === sku);
            if (skuMatch) targetVariant = skuMatch;

            if (targetVariant) {
              const variantUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products/${productId}/variants/${targetVariant.id}`;
              const updateResponse = await fetch(variantUrl, {
                method: 'PUT',
                headers: bcHeaders,
                body: JSON.stringify({ inventory_level: quantity }),
              });

              if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                return jsonResponse(
                  { error: 'Failed to update variant inventory', details: errorText },
                  { status: 400 }
                );
              }

              return jsonResponse({
                success: true,
                action: 'updated',
                message: `Updated inventory for existing product "${name}" to ${quantity} units`,
                bigcommerce_product_id: productId,
              });
            }
          }

          // Product-level tracking
          const inventoryUrl = `https://api.bigcommerce.com/stores/${bigcommerce_store_hash}/v3/catalog/products/${productId}`;
          const updateResponse = await fetch(inventoryUrl, {
            method: 'PUT',
            headers: bcHeaders,
            body: JSON.stringify({ inventory_level: quantity }),
          });

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            return jsonResponse(
              { error: 'Failed to update existing product inventory', details: errorText },
              { status: 400 }
            );
          }

          return jsonResponse({
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
      headers: bcHeaders,
      body: JSON.stringify(productData),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('BigCommerce create product error:', errorText);
      return jsonResponse(
        { error: 'Failed to create product in BigCommerce', details: errorText },
        { status: 400 }
      );
    }

    const createdProduct = await createResponse.json();
    const bigcommerceProductId = createdProduct.data?.id;

    return jsonResponse({
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
