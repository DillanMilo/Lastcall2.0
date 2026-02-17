import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Webhook events we want to subscribe to
const WEBHOOK_EVENTS = [
  'store/product/created',
  'store/product/updated',
  'store/product/deleted',
  'store/product/inventory/updated',
  'store/inventory/entry/updated',
];

interface WebhookRegistration {
  id: number;
  scope: string;
  destination: string;
  is_active: boolean;
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

  // Get organization with BigCommerce credentials
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: org } = await adminClient
    .from('organizations')
    .select('id, bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token')
    .eq('id', userData.org_id)
    .single();

  return org;
}

/**
 * Register a single webhook with BigCommerce
 */
async function registerWebhook(
  storeHash: string,
  clientId: string,
  accessToken: string,
  scope: string,
  destination: string
): Promise<WebhookRegistration | null> {
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': accessToken,
      'X-Auth-Client': clientId,
    },
    body: JSON.stringify({
      scope,
      destination,
      is_active: true,
      headers: {},
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to register webhook ${scope}:`, error);
    return null;
  }

  const { data } = await response.json();
  return data;
}

/**
 * Get existing webhooks from BigCommerce
 */
async function getExistingWebhooks(
  storeHash: string,
  clientId: string,
  accessToken: string
): Promise<WebhookRegistration[]> {
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Auth-Token': accessToken,
      'X-Auth-Client': clientId,
    },
  });

  if (!response.ok) {
    return [];
  }

  const { data } = await response.json();
  return data || [];
}

/**
 * POST /api/integrations/bigcommerce/register-webhooks
 * Registers webhooks with BigCommerce for automatic inventory sync
 */
export async function POST(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const org = await getAuthenticatedOrg(request);

    if (!org) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!org.bigcommerce_store_hash || !org.bigcommerce_client_id || !org.bigcommerce_access_token) {
      return jsonResponse(
        { error: 'BigCommerce is not connected. Please configure your credentials first.' },
        { status: 400 }
      );
    }

    // Get the webhook destination URL from request or use default
    const body = await request.json().catch(() => ({}));
    const baseUrl = body.base_url || process.env.NEXT_PUBLIC_APP_URL || 'https://lastcall2-0-fhth.vercel.app';
    const destination = `${baseUrl}/api/integrations/bigcommerce/webhook`;

    console.log(`Registering webhooks for store ${org.bigcommerce_store_hash} -> ${destination}`);

    // Check existing webhooks
    const existingWebhooks = await getExistingWebhooks(
      org.bigcommerce_store_hash,
      org.bigcommerce_client_id,
      org.bigcommerce_access_token
    );

    const results: { scope: string; status: string; id?: number }[] = [];

    for (const scope of WEBHOOK_EVENTS) {
      // Check if webhook already exists for this scope and destination
      const existing = existingWebhooks.find(
        (w) => w.scope === scope && w.destination === destination
      );

      if (existing) {
        results.push({ scope, status: 'already_exists', id: existing.id });
        continue;
      }

      // Register new webhook
      const webhook = await registerWebhook(
        org.bigcommerce_store_hash,
        org.bigcommerce_client_id,
        org.bigcommerce_access_token,
        scope,
        destination
      );

      if (webhook) {
        results.push({ scope, status: 'created', id: webhook.id });
      } else {
        results.push({ scope, status: 'failed' });
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
    console.error('Error registering webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to register webhooks' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/bigcommerce/register-webhooks
 * Lists currently registered webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const org = await getAuthenticatedOrg(request);

    if (!org) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!org.bigcommerce_store_hash || !org.bigcommerce_client_id || !org.bigcommerce_access_token) {
      return jsonResponse(
        { error: 'BigCommerce is not connected' },
        { status: 400 }
      );
    }

    const webhooks = await getExistingWebhooks(
      org.bigcommerce_store_hash,
      org.bigcommerce_client_id,
      org.bigcommerce_access_token
    );

    return jsonResponse({
      success: true,
      webhooks: webhooks.map((w) => ({
        id: w.id,
        scope: w.scope,
        destination: w.destination,
        is_active: w.is_active,
      })),
    });
  } catch (error) {
    console.error('Error listing webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to list webhooks' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/bigcommerce/register-webhooks
 * Removes all registered webhooks
 */
export async function DELETE(request: NextRequest) {
  try {
    const { jsonResponse } = createRouteHandlerClient(request);
    const org = await getAuthenticatedOrg(request);

    if (!org) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!org.bigcommerce_store_hash || !org.bigcommerce_client_id || !org.bigcommerce_access_token) {
      return jsonResponse(
        { error: 'BigCommerce is not connected' },
        { status: 400 }
      );
    }

    const webhooks = await getExistingWebhooks(
      org.bigcommerce_store_hash,
      org.bigcommerce_client_id,
      org.bigcommerce_access_token
    );

    let deleted = 0;
    for (const webhook of webhooks) {
      const url = `https://api.bigcommerce.com/stores/${org.bigcommerce_store_hash}/v3/hooks/${webhook.id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-Auth-Token': org.bigcommerce_access_token,
          'X-Auth-Client': org.bigcommerce_client_id,
        },
      });

      if (response.ok) {
        deleted++;
      }
    }

    return jsonResponse({
      success: true,
      message: `Deleted ${deleted} webhooks`,
    });
  } catch (error) {
    console.error('Error deleting webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhooks' },
      { status: 500 }
    );
  }
}
