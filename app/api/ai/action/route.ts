import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import OpenAI from 'openai';
import { checkAIRequestLimit, logAIRequest } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ActionResult {
  success: boolean;
  action: string;
  itemsAffected: number;
  message: string;
  details?: string[];
}

/**
 * Verify user belongs to the organization
 */
async function verifyUserOrg(request: NextRequest, orgId: string): Promise<boolean> {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  return userData?.org_id === orgId;
}

/**
 * Parse natural language to extract action parameters using AI
 */
async function parseActionIntent(
  message: string,
  inventoryContext: string
): Promise<{
  action: 'set_expiry' | 'update_quantity' | 'set_reorder_threshold' | 'none';
  filters: {
    invoice?: string;
    sku?: string;
    name_contains?: string;
    category?: string;
  };
  value?: string;
  confidence: number;
} | null> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an inventory action parser. Extract the user's intent to modify inventory items.

Available actions:
- set_expiry: Set expiration date for items
- update_quantity: Adjust quantity for items
- set_reorder_threshold: Set reorder point for items
- none: User is just asking a question, not requesting an action

Available inventory for reference:
${inventoryContext}

Respond with JSON only:
{
  "action": "set_expiry" | "update_quantity" | "set_reorder_threshold" | "none",
  "filters": {
    "invoice": "invoice number if specified",
    "sku": "specific SKU if mentioned",
    "name_contains": "product name pattern if mentioned (e.g. 'Biltong', 'Nuts')",
    "category": "category if mentioned"
  },
  "value": "the new value (date as YYYY-MM-DD for expiry, number for quantity/threshold)",
  "confidence": 0.0-1.0
}

Examples:
- "Set expiry for all Biltong to March 2026" → {"action":"set_expiry","filters":{"name_contains":"Biltong"},"value":"2026-03-31","confidence":0.9}
- "Update invoice INV-123 expiry to June 30, 2026" → {"action":"set_expiry","filters":{"invoice":"INV-123"},"value":"2026-06-30","confidence":0.95}
- "What's running low?" → {"action":"none","filters":{},"confidence":1.0}`,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Execute the inventory action
 */
async function executeAction(
  orgId: string,
  action: string,
  filters: Record<string, string | undefined>,
  value: string
): Promise<ActionResult> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Build query
  let query = supabase
    .from('inventory_items')
    .select('id, name, sku, invoice')
    .eq('org_id', orgId);

  if (filters.invoice) {
    query = query.eq('invoice', filters.invoice);
  }
  if (filters.sku) {
    query = query.eq('sku', filters.sku);
  }
  if (filters.name_contains) {
    query = query.ilike('name', `%${filters.name_contains}%`);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  const { data: matchingItems, error: fetchError } = await query;

  if (fetchError) {
    return {
      success: false,
      action,
      itemsAffected: 0,
      message: `Error finding items: ${fetchError.message}`,
    };
  }

  if (!matchingItems || matchingItems.length === 0) {
    return {
      success: false,
      action,
      itemsAffected: 0,
      message: 'No items matched your criteria. Please be more specific.',
    };
  }

  // Execute the action
  const itemIds = matchingItems.map(i => i.id);
  let updateData: Record<string, unknown> = {};

  switch (action) {
    case 'set_expiry':
      updateData = { expiration_date: value };
      break;
    case 'update_quantity':
      updateData = { quantity: parseInt(value) || 0 };
      break;
    case 'set_reorder_threshold':
      updateData = { reorder_threshold: parseInt(value) || 0 };
      break;
    default:
      return {
        success: false,
        action,
        itemsAffected: 0,
        message: 'Unknown action type',
      };
  }

  const { error: updateError } = await supabase
    .from('inventory_items')
    .update(updateData)
    .in('id', itemIds);

  if (updateError) {
    return {
      success: false,
      action,
      itemsAffected: 0,
      message: `Error updating items: ${updateError.message}`,
    };
  }

  const affectedNames = matchingItems.slice(0, 5).map(i => i.name);
  const moreCount = matchingItems.length > 5 ? matchingItems.length - 5 : 0;

  return {
    success: true,
    action,
    itemsAffected: matchingItems.length,
    message: `Successfully updated ${matchingItems.length} item(s)`,
    details: [
      ...affectedNames,
      ...(moreCount > 0 ? [`...and ${moreCount} more`] : []),
    ],
  };
}

/**
 * POST /api/ai/action
 * Execute AI-powered inventory actions
 */
export async function POST(request: NextRequest) {
  try {
    const { message, orgId } = await request.json();

    if (!message || !orgId) {
      return NextResponse.json(
        { error: 'Message and orgId are required' },
        { status: 400 }
      );
    }

    // Verify user authorization
    const isAuthorized = await verifyUserOrg(request, orgId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get inventory context for parsing
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get organization tier for limit checking
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier')
      .eq('id', orgId)
      .single();

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const tier = (orgData.subscription_tier || 'free') as PlanTier;

    // Check AI request limit
    const limitCheck = await checkAIRequestLimit(supabase, orgId, tier);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'AI request limit reached',
          message: limitCheck.message,
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const { data: inventory } = await supabase
      .from('inventory_items')
      .select('name, sku, invoice, category, expiration_date')
      .eq('org_id', orgId)
      .limit(100);

    const inventoryContext = inventory
      ?.map(i => `${i.name} | SKU: ${i.sku || 'N/A'} | Invoice: ${i.invoice || 'N/A'} | Category: ${i.category || 'N/A'} | Expiry: ${i.expiration_date || 'Not set'}`)
      .join('\n') || 'No inventory items';

    // Parse the user's intent
    const intent = await parseActionIntent(message, inventoryContext);

    if (!intent || intent.action === 'none' || intent.confidence < 0.7) {
      return NextResponse.json({
        isAction: false,
        message: 'This appears to be a question, not an action request.',
      });
    }

    if (!intent.value) {
      return NextResponse.json({
        isAction: true,
        needsConfirmation: true,
        action: intent.action,
        filters: intent.filters,
        message: 'I understood you want to update items, but I need the value. For example: "Set expiry to March 30, 2026"',
      });
    }

    // Execute the action
    const result = await executeAction(orgId, intent.action, intent.filters, intent.value);

    // Log the AI request
    await logAIRequest(supabase, orgId, 'action');

    return NextResponse.json({
      isAction: true,
      ...result,
    });
  } catch (error) {
    console.error('AI action error:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}

