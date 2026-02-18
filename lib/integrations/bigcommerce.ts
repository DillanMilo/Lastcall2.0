import type { InventorySyncItem } from '@/lib/inventory/syncInventoryItems';

interface BigCommerceOptionValue {
  option_display_name?: string;
  label?: string;
  value?: string;
}

interface BigCommerceVariant {
  id: number;
  product_id: number;
  sku?: string;
  inventory_level?: number;
  inventory_warning_level?: number | null;
  option_values?: BigCommerceOptionValue[];
  is_default?: boolean;
}

interface BigCommerceProduct {
  id: number;
  name: string;
  sku?: string;
  inventory_level?: number;
  inventory_warning_level?: number | null;
  inventory_tracking?: 'product' | 'variant' | 'none';
  variants?: BigCommerceVariant[];
}

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    pagination?: {
      total_pages?: number;
      current_page?: number;
    };
  };
}

interface SingleProductResponse {
  data: BigCommerceProduct;
}

function getCredentials() {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const clientId = process.env.BIGCOMMERCE_CLIENT_ID;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;

  if (!storeHash || !clientId || !accessToken) {
    throw new Error('BigCommerce credentials are not fully configured');
  }

  return { storeHash, clientId, accessToken };
}

async function bigCommerceRequest<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const { storeHash, clientId, accessToken } = getCredentials();
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3${endpoint}`;

  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Auth-Token': accessToken,
    'X-Auth-Client': clientId,
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
      `BigCommerce request failed (${response.status}): ${message || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

function buildVariantName(product: BigCommerceProduct, variant?: BigCommerceVariant): string {
  if (!variant) {
    return product.name;
  }

  const optionSummary = variant.option_values
    ?.filter((value) => value.option_display_name && value.label)
    .map((value) => `${value.option_display_name}: ${value.label}`)
    .join(', ');

  if (optionSummary && optionSummary.length > 0) {
    return `${product.name} (${optionSummary})`;
  }

  if (variant.sku && variant.sku !== product.sku) {
    return `${product.name} (${variant.sku})`;
  }

  return product.name;
}

function mapProductVariantToItem(
  product: BigCommerceProduct,
  variant?: BigCommerceVariant
): InventorySyncItem {
  const quantitySource = variant ?? product;

  return {
    name: buildVariantName(product, variant),
    sku: variant?.sku || product.sku || null,
    quantity: quantitySource.inventory_level ?? 0,
    reorder_threshold: quantitySource.inventory_warning_level ?? 0,
    bigcommerce_product_id: product.id,
    bigcommerce_variant_id: variant?.id ?? null,
  };
}

async function bigCommerceRequestWithCredentials<T>(
  endpoint: string,
  credentials: { storeHash: string; clientId: string; accessToken: string },
  init: RequestInit = {}
): Promise<T> {
  const url = `https://api.bigcommerce.com/stores/${credentials.storeHash}/v3${endpoint}`;

  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Auth-Token': credentials.accessToken,
    'X-Auth-Client': credentials.clientId,
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
      `BigCommerce request failed (${response.status}): ${message || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

export async function fetchBigCommerceCatalogItemsWithCredentials(
  credentials: { storeHash: string; clientId: string; accessToken: string }
): Promise<InventorySyncItem[]> {
  const items: InventorySyncItem[] = [];
  let page = 1;
  const limit = 250;
  const maxPages = 100; // Safety limit to prevent infinite loops

  while (page <= maxPages) {
    const response = await bigCommerceRequestWithCredentials<PaginatedResponse<BigCommerceProduct>>(
      `/catalog/products?include=variants&limit=${limit}&page=${page}`,
      credentials
    );

    for (const product of response.data) {
      const variants = product.variants ?? [];

      if (variants.length > 0) {
        for (const variant of variants) {
          items.push(mapProductVariantToItem(product, variant));
        }
      } else {
        items.push(mapProductVariantToItem(product));
      }
    }

    const totalPages = response.meta?.pagination?.total_pages ?? page;
    if (page >= totalPages) {
      break;
    }

    page += 1;
  }

  if (page > maxPages) {
    console.warn(`BigCommerce pagination hit safety limit of ${maxPages} pages (${items.length} items fetched)`);
  }

  return items;
}

export async function fetchBigCommerceCatalogItems(): Promise<InventorySyncItem[]> {
  const credentials = getCredentials();
  return fetchBigCommerceCatalogItemsWithCredentials(credentials);
}

// ===== Order / Sales Data (Read-Only, V2 API) =====

interface BigCommerceOrder {
  id: number;
  status_id: number;
  status: string;
  date_created: string; // RFC 2822
  total_inc_tax: string; // String decimal
  total_ex_tax: string;
  items_total: number;
  currency_code?: string;
}

interface BigCommerceOrderProduct {
  id: number;
  order_id: number;
  product_id: number;
  variant_id: number;
  name: string;
  sku?: string;
  quantity: number;
  price_inc_tax: string; // String decimal
  price_ex_tax: string;
  total_inc_tax: string;
}

export interface BigCommerceOrderSummary {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  itemBreakdown: {
    name: string;
    sku?: string;
    productId: number;
    variantId: number;
    unitsSold: number;
    revenue: number;
  }[];
}

/**
 * Make a request to BigCommerce V2 API (used for orders).
 * V2 returns arrays directly (no { data } wrapper).
 */
async function bigCommerceV2RequestWithCredentials<T>(
  endpoint: string,
  credentials: { storeHash: string; clientId: string; accessToken: string },
): Promise<T> {
  const url = `https://api.bigcommerce.com/stores/${credentials.storeHash}/v2${endpoint}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': credentials.accessToken,
      'X-Auth-Client': credentials.clientId,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    // BigCommerce V2 returns 204 for empty results
    if (response.status === 204) {
      return [] as unknown as T;
    }
    const message = await response.text();
    throw new Error(
      `BigCommerce V2 request failed (${response.status}): ${message || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

/**
 * Fetch completed orders from BigCommerce for a date range (read-only).
 * Uses V2 Orders API with date filters.
 * Completed status IDs: 2 (Shipped), 10 (Completed), 11 (Awaiting Fulfillment), 3 (Partially Shipped)
 */
export async function fetchBigCommerceOrders(
  credentials: { storeHash: string; clientId: string; accessToken: string },
  startDate: Date,
  endDate: Date,
): Promise<BigCommerceOrderSummary> {
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();
  const limit = 250;
  const maxPages = 20;
  let page = 1;

  const allOrders: BigCommerceOrder[] = [];

  // Fetch orders in date range
  while (page <= maxPages) {
    const orders = await bigCommerceV2RequestWithCredentials<BigCommerceOrder[]>(
      `/orders?min_date_created=${encodeURIComponent(startIso)}&max_date_created=${encodeURIComponent(endIso)}&limit=${limit}&page=${page}&sort=date_created:asc`,
      credentials,
    );

    if (!orders || orders.length === 0) break;

    // Filter to completed/shipped orders (exclude cancelled=5, declined=6, refunded=4, etc.)
    const completedStatuses = [2, 3, 10, 11];
    for (const order of orders) {
      if (completedStatuses.includes(order.status_id)) {
        allOrders.push(order);
      }
    }

    if (orders.length < limit) break;
    page++;
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Fetch line items for each order (batched with throttle)
  const itemMap = new Map<string, {
    name: string;
    sku?: string;
    productId: number;
    variantId: number;
    unitsSold: number;
    revenue: number;
  }>();

  let totalRevenue = 0;

  for (const order of allOrders) {
    totalRevenue += parseFloat(order.total_inc_tax) || 0;

    try {
      const products = await bigCommerceV2RequestWithCredentials<BigCommerceOrderProduct[]>(
        `/orders/${order.id}/products`,
        credentials,
      );

      if (products && Array.isArray(products)) {
        for (const product of products) {
          const key = `${product.product_id}-${product.variant_id}`;
          const existing = itemMap.get(key);
          const revenue = parseFloat(product.total_inc_tax) || 0;

          if (existing) {
            existing.unitsSold += product.quantity;
            existing.revenue += revenue;
          } else {
            itemMap.set(key, {
              name: product.name,
              sku: product.sku,
              productId: product.product_id,
              variantId: product.variant_id,
              unitsSold: product.quantity,
              revenue,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch products for order ${order.id}:`, err);
    }

    // Throttle to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const itemBreakdown = Array.from(itemMap.values())
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders: allOrders.length,
    avgOrderValue: allOrders.length > 0
      ? Math.round((totalRevenue / allOrders.length) * 100) / 100
      : 0,
    itemBreakdown,
  };
}

export async function fetchBigCommerceVariantInventory(
  productId: number,
  variantId?: number
): Promise<InventorySyncItem[]> {
  const response = await bigCommerceRequest<SingleProductResponse>(
    `/catalog/products/${productId}?include=variants`
  );

  const product = response.data;
  const variants = product.variants ?? [];

  if (variantId) {
    const match = variants.find((variant) => variant.id === variantId);
    if (!match) {
      return [];
    }
    return [mapProductVariantToItem(product, match)];
  }

  if (variants.length === 0) {
    return [mapProductVariantToItem(product)];
  }

  return variants.map((variant) => mapProductVariantToItem(product, variant));
}
