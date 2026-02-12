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
