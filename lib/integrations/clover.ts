import crypto from 'crypto';
import type { InventorySyncItem } from '@/lib/inventory/syncInventoryItems';

/**
 * Clover POS Integration Client
 *
 * Clover API Documentation: https://docs.clover.com/reference
 *
 * Clover uses OAuth2 for authentication. The access token is obtained through
 * their OAuth flow and stored per-organization.
 *
 * Environment (for webhooks):
 * - US/Canada: https://api.clover.com
 * - EU: https://api.eu.clover.com
 */

// Clover API types
interface CloverItemStock {
  item: {
    id: string;
  };
  stockCount: number;
  quantity?: number;
}

interface CloverItem {
  id: string;
  name: string;
  sku?: string;
  code?: string; // Alternate code/barcode
  price?: number;
  priceType?: 'FIXED' | 'VARIABLE' | 'PER_UNIT';
  stockCount?: number;
  itemStock?: CloverItemStock;
  hidden?: boolean;
  isRevenue?: boolean;
  modifiedTime?: number;
}

interface CloverItemsResponse {
  elements: CloverItem[];
  href?: string;
}

interface CloverCredentials {
  merchantId: string;
  accessToken: string;
  environment?: 'us' | 'eu';
}

/**
 * Get the base API URL for Clover based on environment
 */
function getCloverApiUrl(environment: 'us' | 'eu' = 'us'): string {
  return environment === 'eu'
    ? 'https://api.eu.clover.com'
    : 'https://api.clover.com';
}

/**
 * Make an authenticated request to the Clover API
 */
async function cloverRequest<T>(
  endpoint: string,
  credentials: CloverCredentials,
  init: RequestInit = {}
): Promise<T> {
  const baseUrl = getCloverApiUrl(credentials.environment);
  const url = `${baseUrl}/v3/merchants/${credentials.merchantId}${endpoint}`;

  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${credentials.accessToken}`,
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
      `Clover request failed (${response.status}): ${message || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

/**
 * Test Clover credentials by fetching merchant info
 */
export async function testCloverConnection(
  credentials: CloverCredentials
): Promise<{ success: boolean; merchantName?: string; error?: string }> {
  try {
    const baseUrl = getCloverApiUrl(credentials.environment);
    const url = `${baseUrl}/v3/merchants/${credentials.merchantId}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Authentication failed: ${text || response.statusText}` };
    }

    const merchant = await response.json();
    return { success: true, merchantName: merchant.name };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

/**
 * Fetch all inventory items from Clover
 * Clover uses pagination with limit/offset
 */
export async function fetchCloverInventoryItems(
  credentials: CloverCredentials
): Promise<InventorySyncItem[]> {
  const items: InventorySyncItem[] = [];
  const limit = 100;
  const maxPages = 100; // Safety limit to prevent infinite loops
  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore && pageCount < maxPages) {
    pageCount++;
    // Fetch items with their stock counts
    // expand=itemStock gets the inventory levels
    const response = await cloverRequest<CloverItemsResponse>(
      `/items?expand=itemStock&limit=${limit}&offset=${offset}`,
      credentials
    );

    for (const item of response.elements) {
      // Skip hidden items (deleted/archived)
      if (item.hidden) continue;

      items.push(mapCloverItemToSyncItem(item));
    }

    // Check if there are more items
    if (response.elements.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
      // Throttle pagination requests to avoid Clover API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (pageCount >= maxPages) {
    console.warn(`Clover pagination hit safety limit of ${maxPages} pages (${items.length} items fetched)`);
  }

  return items;
}

/**
 * Fetch a single item from Clover by ID
 */
export async function fetchCloverItem(
  credentials: CloverCredentials,
  itemId: string
): Promise<InventorySyncItem | null> {
  try {
    const item = await cloverRequest<CloverItem>(
      `/items/${itemId}?expand=itemStock`,
      credentials
    );

    if (item.hidden) return null;

    return mapCloverItemToSyncItem(item);
  } catch (error) {
    console.error(`Failed to fetch Clover item ${itemId}:`, error);
    return null;
  }
}

/**
 * Update inventory level in Clover
 * This pushes inventory FROM LastCall TO Clover
 */
export async function updateCloverInventory(
  credentials: CloverCredentials,
  itemId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await cloverRequest(
      `/item_stocks/${itemId}`,
      credentials,
      {
        method: 'POST',
        body: JSON.stringify({ stockCount: quantity }),
      }
    );
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update inventory',
    };
  }
}

/**
 * Create a new item in Clover
 * Used when pushing products FROM LastCall TO Clover
 */
export async function createCloverItem(
  credentials: CloverCredentials,
  item: {
    name: string;
    sku?: string;
    price?: number;
    stockCount?: number;
  }
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  try {
    const cloverItem = await cloverRequest<CloverItem>(
      '/items',
      credentials,
      {
        method: 'POST',
        body: JSON.stringify({
          name: item.name,
          sku: item.sku,
          price: item.price ? Math.round(item.price * 100) : 0, // Clover uses cents
          priceType: 'FIXED',
        }),
      }
    );

    // Set initial stock if provided
    if (item.stockCount !== undefined && item.stockCount > 0) {
      await updateCloverInventory(credentials, cloverItem.id, item.stockCount);
    }

    return { success: true, itemId: cloverItem.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create item',
    };
  }
}

/**
 * Map a Clover item to our InventorySyncItem format
 */
function mapCloverItemToSyncItem(item: CloverItem): InventorySyncItem {
  // Stock count can come from itemStock object or directly on item
  const stockCount = item.itemStock?.stockCount ?? item.stockCount ?? 0;

  return {
    name: item.name,
    sku: item.sku || item.code || null, // Use SKU, fallback to code/barcode
    quantity: stockCount,
    reorder_threshold: 0, // Clover doesn't have this concept, default to 0
    clover_item_id: item.id,
  };
}

/**
 * Verify Clover webhook signature
 * Clover uses HMAC-SHA256 for webhook verification
 */
export function verifyCloverWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Parse Clover webhook event
 * Clover webhooks contain: merchants, type (CREATE/UPDATE/DELETE), objectId, ts
 */
export interface CloverWebhookEvent {
  merchants: Record<string, { objectId: string; type: string; ts: number }[]>;
}

export function parseCloverWebhookPayload(payload: string): CloverWebhookEvent {
  return JSON.parse(payload);
}

// ===== Order / Sales Data (Read-Only) =====

interface CloverLineItem {
  id: string;
  name: string;
  price: number; // cents
  unitQty?: number;
  refunded?: boolean;
  item?: { id: string };
}

interface CloverOrder {
  id: string;
  total: number; // cents
  state: string; // 'open' | 'locked' | 'paid'
  createdTime: number; // Unix ms
  modifiedTime?: number;
  lineItems?: { elements: CloverLineItem[] };
}

interface CloverOrdersResponse {
  elements: CloverOrder[];
  href?: string;
}

export interface CloverOrderSummary {
  totalRevenue: number; // dollars
  totalOrders: number;
  avgOrderValue: number;
  itemBreakdown: {
    name: string;
    cloverItemId?: string;
    unitsSold: number;
    revenue: number; // dollars
  }[];
}

/**
 * Fetch paid orders from Clover for a date range (read-only).
 * Uses GET /v3/merchants/{mId}/orders with createdTime filters.
 * Only returns completed (paid) orders.
 */
export async function fetchCloverOrders(
  credentials: CloverCredentials,
  startDate: Date,
  endDate: Date
): Promise<CloverOrderSummary> {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const limit = 100;
  const maxPages = 50;
  let offset = 0;
  let pageCount = 0;

  const allOrders: CloverOrder[] = [];

  while (pageCount < maxPages) {
    pageCount++;

    const endpoint = `/orders?filter=createdTime>=${startMs}&filter=createdTime<=${endMs}&expand=lineItems&limit=${limit}&offset=${offset}&orderBy=createdTime+ASC`;

    const response = await cloverRequest<CloverOrdersResponse>(
      endpoint,
      credentials
    );

    if (!response.elements || response.elements.length === 0) break;

    // Only include paid orders
    for (const order of response.elements) {
      if (order.state === 'paid') {
        allOrders.push(order);
      }
    }

    if (response.elements.length < limit) break;

    offset += limit;
    // Throttle to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Build summary
  let totalRevenue = 0;
  const itemMap = new Map<string, { name: string; cloverItemId?: string; unitsSold: number; revenue: number }>();

  for (const order of allOrders) {
    totalRevenue += (order.total || 0) / 100; // cents to dollars

    if (order.lineItems?.elements) {
      for (const lineItem of order.lineItems.elements) {
        if (lineItem.refunded) continue;

        const key = lineItem.item?.id || lineItem.name;
        const existing = itemMap.get(key);
        const qty = lineItem.unitQty || 1;
        const revenue = (lineItem.price || 0) / 100 * qty;

        if (existing) {
          existing.unitsSold += qty;
          existing.revenue += revenue;
        } else {
          itemMap.set(key, {
            name: lineItem.name,
            cloverItemId: lineItem.item?.id,
            unitsSold: qty,
            revenue,
          });
        }
      }
    }
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
