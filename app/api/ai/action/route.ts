import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import OpenAI from 'openai';
import { checkAIRequestLimit, logAIRequest } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';
import { checkRateLimit, RATE_LIMITS } from '@/lib/utils/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
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
 * Verify user belongs to the organization and has appropriate role
 */
async function verifyUserOrg(request: NextRequest, orgId: string): Promise<{ authorized: boolean; role?: string }> {
  const { supabase } = createRouteHandlerClient(request);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false };

  const { data: userData } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('id', user.id)
    .single();

  if (userData?.org_id !== orgId) return { authorized: false };

  return { authorized: true, role: userData.role };
}

/**
 * Parse natural language to extract action parameters using AI
 */
async function parseActionIntent(
  message: string,
  inventoryContext: string
): Promise<{
  action: 'set_expiry' | 'update_quantity' | 'add_quantity' | 'subtract_quantity' | 'set_reorder_threshold' | 'none';
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
- update_quantity: Set quantity to a specific number (absolute value)
- add_quantity: Add/increase quantity (received stock, restocking)
- subtract_quantity: Subtract/decrease quantity (sold, used, damaged, removed)
- set_reorder_threshold: Set reorder point for items
- none: User is just asking a question, not requesting an action

Available inventory for reference:
${inventoryContext}

Respond with JSON only:
{
  "action": "set_expiry" | "update_quantity" | "add_quantity" | "subtract_quantity" | "set_reorder_threshold" | "none",
  "filters": {
    "invoice": "invoice number if specified",
    "sku": "specific SKU if mentioned",
    "name_contains": "product name pattern if mentioned (e.g. 'Biltong', 'Nuts')",
    "category": "category if mentioned"
  },
  "value": "the new value (date as YYYY-MM-DD for expiry, INTEGER NUMBER ONLY for quantity/threshold - no text, just digits)",
  "confidence": 0.0-1.0
}

IMPORTANT: For quantity and reorder threshold values, extract ONLY the number as a string of digits. Do not include units like "units" or other text.

IMPORTANT: Distinguish between SET (absolute) vs ADD/SUBTRACT (relative):
- "Set quantity to 50" or "Change quantity to 50" → update_quantity (absolute)
- "Add 20" or "Received 20" or "Restock 20" or "Got 20 more" → add_quantity (relative increase)
- "Remove 10" or "Sold 10" or "Used 10" or "Subtract 10" or "Damaged 5" → subtract_quantity (relative decrease)

Examples:
- "Set expiry for all Biltong to March 2026" → {"action":"set_expiry","filters":{"name_contains":"Biltong"},"value":"2026-03-31","confidence":0.9}
- "Update invoice INV-123 expiry to June 30, 2026" → {"action":"set_expiry","filters":{"invoice":"INV-123"},"value":"2026-06-30","confidence":0.95}
- "Set reorder level for Biltong to 50" → {"action":"set_reorder_threshold","filters":{"name_contains":"Biltong"},"value":"50","confidence":0.95}
- "Change quantity of Droewors to 75" → {"action":"update_quantity","filters":{"name_contains":"Droewors"},"value":"75","confidence":0.9}
- "Add 20 units to Biltong" → {"action":"add_quantity","filters":{"name_contains":"Biltong"},"value":"20","confidence":0.95}
- "Received 100 Droewors" → {"action":"add_quantity","filters":{"name_contains":"Droewors"},"value":"100","confidence":0.9}
- "Sold 15 Nuts today" → {"action":"subtract_quantity","filters":{"name_contains":"Nuts"},"value":"15","confidence":0.9}
- "Remove 5 from invoice INV-123" → {"action":"subtract_quantity","filters":{"invoice":"INV-123"},"value":"5","confidence":0.95}
- "We used 10 of the Biltong" → {"action":"subtract_quantity","filters":{"name_contains":"Biltong"},"value":"10","confidence":0.9}
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
    // Sanitize input: limit length and escape LIKE special characters
    const sanitized = filters.name_contains.slice(0, 100).replace(/[%_]/g, '\\$&');
    query = query.ilike('name', `%${sanitized}%`);
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
  let updateError: { message: string } | null = null;

  switch (action) {
    case 'set_expiry': {
      const { error } = await supabase
        .from('inventory_items')
        .update({ expiration_date: value })
        .in('id', itemIds);
      updateError = error;
      break;
    }
    case 'update_quantity': {
      const { error } = await supabase
        .from('inventory_items')
        .update({ quantity: parseInt(value) || 0 })
        .in('id', itemIds);
      updateError = error;
      break;
    }
    case 'add_quantity': {
      // Fetch current quantities and add the value
      const { data: currentItems, error: fetchErr } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .in('id', itemIds);

      if (fetchErr) {
        return {
          success: false,
          action,
          itemsAffected: 0,
          message: `Error fetching current quantities: ${fetchErr.message}`,
        };
      }

      const addValue = parseInt(value) || 0;

      // Update each item with its new quantity
      for (const item of currentItems || []) {
        const newQuantity = (item.quantity || 0) + addValue;
        const { error } = await supabase
          .from('inventory_items')
          .update({ quantity: newQuantity })
          .eq('id', item.id);
        if (error) {
          updateError = error;
          break;
        }
      }
      break;
    }
    case 'subtract_quantity': {
      // Fetch current quantities and subtract the value
      const { data: currentItems, error: fetchErr } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .in('id', itemIds);

      if (fetchErr) {
        return {
          success: false,
          action,
          itemsAffected: 0,
          message: `Error fetching current quantities: ${fetchErr.message}`,
        };
      }

      const subtractValue = parseInt(value) || 0;

      // Update each item with its new quantity (don't go below 0)
      for (const item of currentItems || []) {
        const newQuantity = Math.max(0, (item.quantity || 0) - subtractValue);
        const { error } = await supabase
          .from('inventory_items')
          .update({ quantity: newQuantity })
          .eq('id', item.id);
        if (error) {
          updateError = error;
          break;
        }
      }
      break;
    }
    case 'set_reorder_threshold': {
      const { error } = await supabase
        .from('inventory_items')
        .update({ reorder_threshold: parseInt(value) || 0 })
        .in('id', itemIds);
      updateError = error;
      break;
    }
    default:
      return {
        success: false,
        action,
        itemsAffected: 0,
        message: 'Unknown action type',
      };
  }

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

  // Create action-specific success message
  let successMessage = `Successfully updated ${matchingItems.length} item(s)`;
  if (action === 'add_quantity') {
    successMessage = `Added ${value} units to ${matchingItems.length} item(s)`;
  } else if (action === 'subtract_quantity') {
    successMessage = `Removed ${value} units from ${matchingItems.length} item(s)`;
  } else if (action === 'set_expiry') {
    successMessage = `Set expiration date to ${value} for ${matchingItems.length} item(s)`;
  } else if (action === 'set_reorder_threshold') {
    successMessage = `Set reorder threshold to ${value} for ${matchingItems.length} item(s)`;
  } else if (action === 'update_quantity') {
    successMessage = `Set quantity to ${value} for ${matchingItems.length} item(s)`;
  }

  return {
    success: true,
    action,
    itemsAffected: matchingItems.length,
    message: successMessage,
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
    const { jsonResponse } = createRouteHandlerClient(request);
    const { message, orgId } = await request.json();

    if (!message || !orgId) {
      return jsonResponse(
        { error: 'Message and orgId are required' },
        { status: 400 }
      );
    }

    // Rate limit AI actions
    const rateCheck = checkRateLimit(`ai:${orgId}`, RATE_LIMITS.ai);
    if (!rateCheck.allowed) {
      return jsonResponse(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    // Verify user authorization and role
    const authCheck = await verifyUserOrg(request, orgId);
    if (!authCheck.authorized) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners and admins can execute AI actions that modify inventory
    if (authCheck.role !== 'owner' && authCheck.role !== 'admin') {
      return jsonResponse(
        { error: 'Only owners and admins can execute inventory actions' },
        { status: 403 }
      );
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
      return jsonResponse(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const tier = (orgData.subscription_tier || 'free') as PlanTier;

    // Check AI request limit
    const limitCheck = await checkAIRequestLimit(supabase, orgId, tier);
    if (!limitCheck.allowed) {
      return jsonResponse(
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
      return jsonResponse({
        isAction: false,
        message: 'This appears to be a question, not an action request.',
      });
    }

    if (!intent.value) {
      return jsonResponse({
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

    return jsonResponse({
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
