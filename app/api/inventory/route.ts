import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { checkInventoryLimit } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

interface UserOrgInfo {
  orgId: string;
  tier: PlanTier;
}

/**
 * Get the authenticated user's organization ID and subscription tier
 */
async function getUserOrgInfo(request: NextRequest): Promise<UserOrgInfo | null> {
  try {
    const { supabase } = createRouteHandlerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return null;
    }

    // Get organization tier
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier')
      .eq('id', userData.org_id)
      .single();

    if (orgError || !orgData) {
      return null;
    }

    return {
      orgId: userData.org_id,
      tier: (orgData.subscription_tier || 'free') as PlanTier,
    };
  } catch (error) {
    console.error('Error getting user organization:', error);
    return null;
  }
}

/**
 * GET /api/inventory
 * Fetch all inventory items for an organization
 * Query params: org_id (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, jsonResponse } = createRouteHandlerClient(request);

    // Authenticate user and get their org
    const userOrgInfo = await getUserOrgInfo(request);
    if (!userOrgInfo) {
      return jsonResponse(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedOrgId = searchParams.get('org_id');

    // Validate that user can only access their own organization's data
    if (!requestedOrgId || requestedOrgId !== userOrgInfo.orgId) {
      return jsonResponse(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('org_id', requestedOrgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inventory:', error);
      return jsonResponse(
        { error: 'Failed to fetch inventory' },
        { status: 500 }
      );
    }

    return jsonResponse({
      success: true,
      count: data.length,
      items: data,
    });
  } catch (error) {
    console.error('Error in GET /api/inventory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory
 * Create new inventory item(s)
 * Body: { org_id, items: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, jsonResponse } = createRouteHandlerClient(request);

    // Authenticate user and get their org
    const userOrgInfo = await getUserOrgInfo(request);
    if (!userOrgInfo) {
      return jsonResponse(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { org_id, items } = body;

    // Validate that user can only create items for their own organization
    if (!org_id || org_id !== userOrgInfo.orgId) {
      return jsonResponse(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { error: 'items array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Check inventory limit before creating items
    const limitCheck = await checkInventoryLimit(supabase, org_id, userOrgInfo.tier);

    if (!limitCheck.allowed) {
      return jsonResponse(
        {
          error: 'Limit exceeded',
          message: limitCheck.message,
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // Check if adding these items would exceed the limit
    const itemsToAdd = items.length;
    const wouldExceed = limitCheck.limit && limitCheck.currentCount !== undefined
      ? (limitCheck.currentCount + itemsToAdd) > limitCheck.limit
      : false;

    if (wouldExceed && limitCheck.limit !== -1) {
      const remaining = limitCheck.limit! - (limitCheck.currentCount || 0);
      return jsonResponse(
        {
          error: 'Limit exceeded',
          message: `You can only add ${remaining} more item${remaining === 1 ? '' : 's'}. Upgrade your plan to add more products.`,
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
          attemptedToAdd: itemsToAdd,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // Validate and prepare items
    const preparedItems = items.map((item) => {
      if (!item.name) {
        throw new Error('Each item must have a name');
      }

      return {
        org_id,
        name: item.name,
        sku: item.sku || null,
        invoice: item.invoice || null,
        quantity: parseInt(item.quantity || '0', 10),
        reorder_threshold: parseInt(item.reorder_threshold || '0', 10),
        category: item.category || null,
        ai_label: item.ai_label || null,
        expiration_date: item.expiration_date || null,
      };
    });

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(preparedItems)
      .select();

    if (error) {
      console.error('Error inserting inventory:', error);
      return jsonResponse(
        { error: 'Failed to create inventory items', details: error.message },
        { status: 500 }
      );
    }

    return jsonResponse({
      success: true,
      count: data.length,
      items: data,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/inventory:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
