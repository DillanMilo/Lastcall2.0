import type { InventorySyncItem } from '@/lib/inventory/syncInventoryItems';

const SHOPIFY_API_VERSION = '2024-01';

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  sku?: string;
  inventory_quantity?: number;
  option1?: string;
  option2?: string;
  option3?: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
  options?: Array<{ name: string; position: number }>;
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface ShopifyProductResponse {
  product: ShopifyProduct;
}

interface ShopifyShopResponse {
  shop: {
    name: string;
    domain: string;
    email: string;
  };
}

export interface ShopifyCredentials {
  storeDomain: string;
  accessToken: string;
}

/**
 * Normalize store domain to ensure consistent format
 * Accepts: mystore, mystore.myshopify.com, https://mystore.myshopify.com
 */
function normalizeStoreDomain(domain: string): string {
  let normalized = domain.trim().toLowerCase();

  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');

  // Add .myshopify.com if not present
  if (!normalized.includes('.myshopify.com')) {
    normalized = `${normalized}.myshopify.com`;
  }

  return normalized;
}

/**
 * Make an authenticated request to the Shopify Admin API
 */
async function shopifyRequest<T>(
  endpoint: string,
  credentials: ShopifyCredentials,
  init: RequestInit = {}
): Promise<T> {
  const storeDomain = normalizeStoreDomain(credentials.storeDomain);
  const url = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}${endpoint}`;

  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': credentials.accessToken,
    ...(init.headers || {}),
  };

  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Shopify request failed (${response.status}): ${message || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

/**
 * Build a descriptive name for a variant
 */
function buildVariantName(
  product: ShopifyProduct,
  variant: ShopifyVariant
): string {
  // If there's only one variant with title "Default Title", just use product name
  if (product.variants.length === 1 && variant.title === 'Default Title') {
    return product.title;
  }

  // Build option string from variant options
  const optionParts: string[] = [];
  const options = product.options || [];

  if (variant.option1 && options[0]) {
    optionParts.push(`${options[0].name}: ${variant.option1}`);
  }
  if (variant.option2 && options[1]) {
    optionParts.push(`${options[1].name}: ${variant.option2}`);
  }
  if (variant.option3 && options[2]) {
    optionParts.push(`${options[2].name}: ${variant.option3}`);
  }

  if (optionParts.length > 0) {
    return `${product.title} (${optionParts.join(', ')})`;
  }

  // Fallback to variant title if no options
  if (variant.title && variant.title !== 'Default Title') {
    return `${product.title} (${variant.title})`;
  }

  return product.title;
}

/**
 * Map a Shopify product variant to an inventory sync item
 */
function mapVariantToItem(
  product: ShopifyProduct,
  variant: ShopifyVariant
): InventorySyncItem {
  return {
    name: buildVariantName(product, variant),
    sku: variant.sku || null,
    quantity: variant.inventory_quantity ?? 0,
    reorder_threshold: 0, // Shopify doesn't have this concept
    shopify_product_id: product.id,
    shopify_variant_id: variant.id,
  };
}

/**
 * Test connection to a Shopify store
 * Returns shop info if successful
 */
export async function testShopifyConnection(
  credentials: ShopifyCredentials
): Promise<{ success: boolean; shopName?: string; error?: string }> {
  try {
    const response = await shopifyRequest<ShopifyShopResponse>(
      '/shop.json',
      credentials
    );

    return {
      success: true,
      shopName: response.shop.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Fetch products from a Shopify store (first page)
 * For full pagination, use fetchAllShopifyProducts
 */
export async function fetchShopifyCatalogItems(
  credentials: ShopifyCredentials
): Promise<InventorySyncItem[]> {
  const items: InventorySyncItem[] = [];
  const limit = 250; // Shopify max per page

  const response = await shopifyRequest<ShopifyProductsResponse>(
    `/products.json?limit=${limit}`,
    credentials
  );

  for (const product of response.products) {
    for (const variant of product.variants) {
      items.push(mapVariantToItem(product, variant));
    }
  }

  return items;
}

/**
 * Fetch all products with proper cursor-based pagination
 */
export async function fetchAllShopifyProducts(
  credentials: ShopifyCredentials
): Promise<InventorySyncItem[]> {
  const items: InventorySyncItem[] = [];
  const limit = 250;
  const maxPages = 100; // Safety limit to prevent infinite loops
  let sinceId = 0;
  let pageCount = 0;

  while (pageCount < maxPages) {
    pageCount++;
    const endpoint = `/products.json?limit=${limit}&since_id=${sinceId}`;

    const response = await shopifyRequest<ShopifyProductsResponse>(
      endpoint,
      credentials
    );

    if (response.products.length === 0) {
      break;
    }

    for (const product of response.products) {
      for (const variant of product.variants) {
        items.push(mapVariantToItem(product, variant));
      }
      // Update sinceId for next page
      sinceId = Math.max(sinceId, product.id);
    }

    // If we got less than limit, we're done
    if (response.products.length < limit) {
      break;
    }
  }

  if (pageCount >= maxPages) {
    console.warn(`Shopify pagination hit safety limit of ${maxPages} pages (${items.length} items fetched)`);
  }

  return items;
}

/**
 * Fetch a single product by ID
 */
export async function fetchShopifyProduct(
  credentials: ShopifyCredentials,
  productId: number
): Promise<InventorySyncItem[]> {
  const response = await shopifyRequest<ShopifyProductResponse>(
    `/products/${productId}.json`,
    credentials
  );

  const product = response.product;
  return product.variants.map((variant) => mapVariantToItem(product, variant));
}

/**
 * Get product count from Shopify store
 */
export async function getShopifyProductCount(
  credentials: ShopifyCredentials
): Promise<number> {
  const response = await shopifyRequest<{ count: number }>(
    '/products/count.json',
    credentials
  );

  return response.count;
}

export { normalizeStoreDomain };
