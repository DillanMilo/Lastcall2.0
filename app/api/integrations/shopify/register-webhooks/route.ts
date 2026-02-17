import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { normalizeStoreDomain } from '@/lib/integrations/shopify';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SHOPIFY_API_VERSION = '2024-01';

// Webhook topics we want to subscribe to
const WEBHOOK_TOPICS = [
  'products/create',
  'products/update',
  'products/delete',
  'inventory_levels/update',
];

interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
  format: string;
}

interface WebhooksResponse {
  webhooks: ShopifyWebhook[];
}

/**
 * Verify user is authenticated and get their org
 */
async function getAuthenticatedOrg(request: NextRequest) {
  const { supabase } = createRouteHandlerClient(request);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Get user's organization
  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (!userData?.org_id) {
    return null;
  }

  // Get organization with Shopify credentials
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: org } = await adminClient
    .from('organizations')
    .select('id, shopify_store_domain, shopify_access_token')
    .eq('id', userData.org_id)
    .single();

  return org;
}

/**
 * Make a request to Shopify Admin API
 */
async function shopifyAdminRequest<T>(
  storeDomain: string,
  accessToken: string,
  endpoint: string,
  init: RequestInit = {}
): Promise<T> {
  const normalizedDomain = normalizeStoreDomain(storeDomain);
  const url = `https://${normalizedDomain}/admin/api/${SHOPIFY_API_VERSION}${endpoint}`;

  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
    ...(init.headers || {}),
  };

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${error}`);
  }

  return (await response.json()) as T;
}

/**
 * Get existing webhooks from Shopify
 */
async function getExistingWebhooks(
  storeDomain: string,
  accessToken: string
): Promise<ShopifyWebhook[]> {
  try {
    const response = await shopifyAdminRequest<WebhooksResponse>(
      storeDomain,
      accessToken,
      '/webhooks.json'
    );
    return response.webhooks || [];
  } catch {
    return [];
  }
}

/**
 * Register a single webhook with Shopify
 */
async function registerWebhook(
  storeDomain: string,
  accessToken: string,
  topic: string,
  address: string
): Promise<ShopifyWebhook | null> {
  try {
    const response = await shopifyAdminRequest<{ webhook: ShopifyWebhook }>(
      storeDomain,
      accessToken,
      '/webhooks.json',
      {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            topic,
            address,
            format: 'json',
          },
        }),
      }
    );
    return response.webhook;
  } catch (error) {
    console.error(`Failed to register webhook ${topic}:`, error);
    return null;
  }
}

/**
 * POST /api/integrations/shopify/register-webhooks
 * Registers webhooks with Shopify for automatic inventory sync
 */
export async function POST(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const org = await getAuthenticatedOrg(request);

    if (!org) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!org.shopify_store_domain || !org.shopify_access_token) {
      return jsonResponse(
        { error: 'Shopify is not connected. Please configure your credentials first.' },
        { status: 400 }
      );
    }

    // Get the webhook destination URL from request or use default
    const body = await request.json().catch(() => ({}));
    const baseUrl = body.base_url || process.env.NEXT_PUBLIC_APP_URL || 'https://lastcall2-0-fhth.vercel.app';
    const destination = `${baseUrl}/api/integrations/shopify/webhook`;

    console.log(`Registering Shopify webhooks for store ${org.shopify_store_domain} -> ${destination}`);

    // Check existing webhooks
    const existingWebhooks = await getExistingWebhooks(
      org.shopify_store_domain,
      org.shopify_access_token
    );

    const results: { topic: string; status: string; id?: number }[] = [];

    for (const topic of WEBHOOK_TOPICS) {
      // Check if webhook already exists for this topic and destination
      const existing = existingWebhooks.find(
        (w) => w.topic === topic && w.address === destination
      );

      if (existing) {
        results.push({ topic, status: 'already_exists', id: existing.id });
        continue;
      }

      // Register new webhook
      const webhook = await registerWebhook(
        org.shopify_store_domain,
        org.shopify_access_token,
        topic,
        destination
      );

      if (webhook) {
        results.push({ topic, status: 'created', id: webhook.id });
      } else {
        results.push({ topic, status: 'failed' });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const existing = results.filter((r) => r.status === 'already_exists').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return jsonResponse({
      success: failed === 0,
      message: `Webhooks registered: ${created} created, ${existing} already existed, ${failed} failed`,
      destination,
      results,
    });
  } catch (error) {
    console.error('Error registering Shopify webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to register webhooks' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/shopify/register-webhooks
 * Lists currently registered webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const org = await getAuthenticatedOrg(request);

    if (!org) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!org.shopify_store_domain || !org.shopify_access_token) {
      return jsonResponse(
        { error: 'Shopify is not connected' },
        { status: 400 }
      );
    }

    const webhooks = await getExistingWebhooks(
      org.shopify_store_domain,
      org.shopify_access_token
    );

    return jsonResponse({
      success: true,
      webhooks: webhooks.map((w) => ({
        id: w.id,
        topic: w.topic,
        address: w.address,
        format: w.format,
      })),
    });
  } catch (error) {
    console.error('Error listing Shopify webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to list webhooks' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/shopify/register-webhooks
 * Removes all registered webhooks
 */
export async function DELETE(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const org = await getAuthenticatedOrg(request);

    if (!org) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!org.shopify_store_domain || !org.shopify_access_token) {
      return jsonResponse(
        { error: 'Shopify is not connected' },
        { status: 400 }
      );
    }

    const webhooks = await getExistingWebhooks(
      org.shopify_store_domain,
      org.shopify_access_token
    );

    let deleted = 0;
    for (const webhook of webhooks) {
      try {
        await shopifyAdminRequest(
          org.shopify_store_domain,
          org.shopify_access_token,
          `/webhooks/${webhook.id}.json`,
          { method: 'DELETE' }
        );
        deleted++;
      } catch {
        // Continue with other webhooks
      }
    }

    return jsonResponse({
      success: true,
      message: `Deleted ${deleted} webhooks`,
    });
  } catch (error) {
    console.error('Error deleting Shopify webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhooks' },
      { status: 500 }
    );
  }
}
