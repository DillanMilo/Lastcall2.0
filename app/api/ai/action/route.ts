import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import OpenAI from 'openai';
import { checkAIRequestLimit, checkInventoryLimit, logAIRequest } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';
import { checkRateLimit, RATE_LIMITS } from '@/lib/utils/rate-limit';
import { generateSKU } from '@/lib/inventory/skuGenerator';

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
  action: 'set_expiry' | 'update_quantity' | 'add_quantity' | 'subtract_quantity' | 'set_reorder_threshold' | 'add_item' | 'delete_item' | 'edit_item' | 'mark_ordered' | 'mark_received' | 'generate_sku' | 'none';
  filters: {
    invoice?: string;
    sku?: string;
    name_contains?: string;
    category?: string;
    item_type?: string;
    operational_category?: string;
  };
  value?: string;
  edit_field?: string;
  item_data?: {
    name: string;
    quantity?: number;
    category?: string;
    item_type?: string;
    operational_category?: string;
    reorder_threshold?: number;
    expiration_date?: string;
    invoice?: string;
  };
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
- add_item: Create a new inventory item (use when user wants to add a NEW product/item to inventory, not add quantity to existing)
- delete_item: Delete/remove an inventory item permanently
- edit_item: Change item details like name, category, SKU, or operational_category
- mark_ordered: Mark items as ordered (pending delivery from supplier)
- mark_received: Mark ordered items as received (delivery arrived, clears order status)
- generate_sku: Generate/assign a SKU for items that don't have one
- none: User is just asking a question, not requesting an action

Available inventory for reference:
${inventoryContext}

Respond with JSON only:
{
  "action": "set_expiry" | "update_quantity" | "add_quantity" | "subtract_quantity" | "set_reorder_threshold" | "add_item" | "delete_item" | "edit_item" | "mark_ordered" | "mark_received" | "generate_sku" | "none",
  "filters": {
    "invoice": "invoice number if specified",
    "sku": "specific SKU if mentioned",
    "name_contains": "product name pattern if mentioned (e.g. 'Biltong', 'Nuts')",
    "category": "category if mentioned",
    "item_type": "stock or operational if specified",
    "operational_category": "cleaning/office/kitchen/packaging/tableware/maintenance/safety if specified"
  },
  "value": "the new value (date as YYYY-MM-DD for expiry, INTEGER NUMBER ONLY for quantity/threshold, text for edit_item)",
  "edit_field": "which field to edit for edit_item: name, category, sku, or operational_category",
  "item_data": {
    "name": "item name (REQUIRED for add_item)",
    "quantity": 0,
    "category": "category if mentioned",
    "item_type": "stock or operational (default stock)",
    "operational_category": "cleaning/office/kitchen/packaging/tableware/maintenance/safety (only for operational items)",
    "reorder_threshold": 0,
    "expiration_date": "YYYY-MM-DD if mentioned",
    "invoice": "invoice if mentioned"
  },
  "confidence": 0.0-1.0
}

IMPORTANT: For quantity and reorder threshold values, extract ONLY the number as a string of digits.

IMPORTANT: Distinguish between ADD ITEM (create new) vs ADD QUANTITY (to existing):
- "Add Paper Towels to inventory" or "Create new item Paper Towels" → add_item (creating a new product)
- "Add 20 units to Biltong" or "Received 20 Biltong" → add_quantity (adding stock to existing item)
- Key difference: if the item already exists in inventory, it's add_quantity. If it's a new product, it's add_item.

IMPORTANT: Distinguish between SET (absolute) vs ADD/SUBTRACT (relative):
- "Set quantity to 50" or "Change quantity to 50" → update_quantity (absolute)
- "Add 20" or "Received 20" or "Restock 20" → add_quantity (relative increase)
- "Remove 10" or "Sold 10" or "Used 10" or "Subtract 10" → subtract_quantity (relative decrease)

IMPORTANT: For add_item, infer item_type from context:
- Mentions cleaning, office supplies, kitchen supplies, packaging, tableware, maintenance, safety → operational
- Mentions "operational" explicitly → operational
- Products for sale, food items, beverages → stock
- If unclear, default to stock

IMPORTANT: For ALL actions (not just add_item), ALWAYS set the item_type and operational_category filters when the user mentions operational items or operational categories:
- If the user says "operational" or mentions cleaning/office/kitchen/packaging/tableware/maintenance/safety → set filters.item_type to "operational" AND set filters.operational_category to the specific category
- If the user says "stock items" or "sellable items" or "products for sale" → set filters.item_type to "stock"
- This ensures actions like generate_sku, update_quantity, set_expiry, etc. only affect the correct type of inventory and never accidentally touch the wrong items

Examples:
- "Set expiry for all Biltong to March 2026" → {"action":"set_expiry","filters":{"name_contains":"Biltong"},"value":"2026-03-31","confidence":0.9}
- "Update invoice INV-123 expiry to June 30, 2026" → {"action":"set_expiry","filters":{"invoice":"INV-123"},"value":"2026-06-30","confidence":0.95}
- "Set reorder level for Biltong to 50" → {"action":"set_reorder_threshold","filters":{"name_contains":"Biltong"},"value":"50","confidence":0.95}
- "Change quantity of Droewors to 75" → {"action":"update_quantity","filters":{"name_contains":"Droewors"},"value":"75","confidence":0.9}
- "Add 20 units to Biltong" → {"action":"add_quantity","filters":{"name_contains":"Biltong"},"value":"20","confidence":0.95}
- "Received 100 Droewors" → {"action":"add_quantity","filters":{"name_contains":"Droewors"},"value":"100","confidence":0.9}
- "Sold 15 Nuts today" → {"action":"subtract_quantity","filters":{"name_contains":"Nuts"},"value":"15","confidence":0.9}
- "Add 50 Paper Towels as operational cleaning item" → {"action":"add_item","item_data":{"name":"Paper Towels","quantity":50,"item_type":"operational","operational_category":"cleaning","reorder_threshold":10},"confidence":0.9}
- "Create new item: Angus Biltong Original, Snacks category, 100 units" → {"action":"add_item","item_data":{"name":"Angus Biltong Original","quantity":100,"category":"Snacks","item_type":"stock","reorder_threshold":10},"confidence":0.9}
- "Delete the expired Biltong" → {"action":"delete_item","filters":{"name_contains":"Biltong"},"confidence":0.85}
- "Remove Paper Towels from inventory" → {"action":"delete_item","filters":{"name_contains":"Paper Towels"},"confidence":0.85}
- "Rename Biltong 100g to Angus Biltong Original 100g" → {"action":"edit_item","filters":{"name_contains":"Biltong 100g"},"value":"Angus Biltong Original 100g","edit_field":"name","confidence":0.9}
- "Change the category of Droewors to Meat Snacks" → {"action":"edit_item","filters":{"name_contains":"Droewors"},"value":"Meat Snacks","edit_field":"category","confidence":0.9}
- "Mark all low stock items as ordered" → {"action":"mark_ordered","filters":{"name_contains":""},"confidence":0.8}
- "Mark Biltong as ordered" → {"action":"mark_ordered","filters":{"name_contains":"Biltong"},"confidence":0.95}
- "Mark Biltong as received with 100 units" → {"action":"mark_received","filters":{"name_contains":"Biltong"},"value":"100","confidence":0.9}
- "Received shipment for invoice INV-123" → {"action":"mark_received","filters":{"invoice":"INV-123"},"confidence":0.9}
- "Generate SKU for Paper Towels" → {"action":"generate_sku","filters":{"name_contains":"Paper Towels"},"confidence":0.95}
- "Assign SKUs to all items without one" → {"action":"generate_sku","filters":{},"confidence":0.9}
- "Generate SKUs for my operational cleaning items" → {"action":"generate_sku","filters":{"item_type":"operational","operational_category":"cleaning"},"confidence":0.9}
- "Create a SKU for kitchen supplies" → {"action":"generate_sku","filters":{"item_type":"operational","operational_category":"kitchen"},"confidence":0.9}
- "Add Dish Soap as an operational kitchen item with 20 units" → {"action":"add_item","item_data":{"name":"Dish Soap","quantity":20,"item_type":"operational","operational_category":"kitchen","reorder_threshold":5},"confidence":0.95}
- "Update quantity of all cleaning items to 50" → {"action":"update_quantity","filters":{"item_type":"operational","operational_category":"cleaning"},"value":"50","confidence":0.9}
- "Set reorder level for operational office supplies to 10" → {"action":"set_reorder_threshold","filters":{"item_type":"operational","operational_category":"office"},"value":"10","confidence":0.9}
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
  value: string,
  itemData?: Record<string, unknown>,
  editField?: string,
  tier?: PlanTier,
  billingExempt?: boolean
): Promise<ActionResult> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // add_item creates a new item - doesn't need to match existing items
  if (action === 'add_item') {
    if (!itemData?.name) {
      return { success: false, action, itemsAffected: 0, message: 'Item name is required to add a new item. Try: "Add [name] with [quantity] units"' };
    }

    // Check inventory tier limit
    const limitCheck = await checkInventoryLimit(supabase, orgId, tier || 'free', billingExempt);
    if (!limitCheck.allowed) {
      return { success: false, action, itemsAffected: 0, message: limitCheck.message || 'Inventory limit reached for your plan. Please upgrade to add more items.' };
    }

    // Get existing SKUs for unique generation
    const { data: existingSKUs } = await supabase
      .from('inventory_items')
      .select('sku')
      .eq('org_id', orgId);

    const skuList = (existingSKUs || []).map((i: { sku: string | null }) => i.sku).filter(Boolean) as string[];
    const itemType = (itemData.item_type as string) === 'operational' ? 'operational' : 'stock';
    const sku = generateSKU(
      itemData.name as string,
      itemData.category as string | undefined,
      itemData.operational_category as string | undefined,
      skuList
    );

    const { error } = await supabase
      .from('inventory_items')
      .insert([{
        org_id: orgId,
        name: itemData.name,
        sku,
        quantity: parseInt(String(itemData.quantity || '0')) || 0,
        reorder_threshold: parseInt(String(itemData.reorder_threshold || '0')) || 0,
        category: itemData.category || null,
        item_type: itemType,
        operational_category: itemType === 'operational' ? (itemData.operational_category || null) : null,
        expiration_date: itemData.expiration_date || null,
        invoice: itemData.invoice || null,
      }]);

    if (error) {
      return { success: false, action, itemsAffected: 0, message: `Error creating item: ${error.message}` };
    }

    return {
      success: true, action, itemsAffected: 1,
      message: `Created "${itemData.name}" (SKU: ${sku}, Type: ${itemType}) with ${itemData.quantity || 0} units`,
      details: [itemData.name as string],
    };
  }

  // All other actions need to match existing items first
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
    const sanitized = filters.name_contains.slice(0, 100).replace(/[%_]/g, '\\$&');
    query = query.ilike('name', `%${sanitized}%`);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.item_type) {
    query = query.eq('item_type', filters.item_type);
  }
  if (filters.operational_category) {
    query = query.eq('operational_category', filters.operational_category);
  }

  // For generate_sku with no filters, target items without SKUs
  if (action === 'generate_sku' && !filters.name_contains && !filters.invoice && !filters.sku && !filters.category) {
    query = query.is('sku', null);
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
      const { data: currentItems, error: fetchErr } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .in('id', itemIds);

      if (fetchErr) {
        return {
          success: false, action, itemsAffected: 0,
          message: `Error fetching current quantities: ${fetchErr.message}`,
        };
      }

      const addValue = parseInt(value) || 0;
      for (const item of currentItems || []) {
        const newQuantity = (item.quantity || 0) + addValue;
        const { error } = await supabase
          .from('inventory_items')
          .update({ quantity: newQuantity })
          .eq('id', item.id);
        if (error) { updateError = error; break; }
      }
      break;
    }
    case 'subtract_quantity': {
      const { data: currentItems, error: fetchErr } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .in('id', itemIds);

      if (fetchErr) {
        return {
          success: false, action, itemsAffected: 0,
          message: `Error fetching current quantities: ${fetchErr.message}`,
        };
      }

      const subtractValue = parseInt(value) || 0;
      for (const item of currentItems || []) {
        const newQuantity = Math.max(0, (item.quantity || 0) - subtractValue);
        const { error } = await supabase
          .from('inventory_items')
          .update({ quantity: newQuantity })
          .eq('id', item.id);
        if (error) { updateError = error; break; }
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
    case 'delete_item': {
      // Safety: refuse to delete more than 5 items at once
      if (matchingItems.length > 5) {
        return {
          success: false, action, itemsAffected: 0,
          message: `Found ${matchingItems.length} matching items. That's too many to delete at once - please be more specific (use exact name, SKU, or invoice) to avoid accidentally deleting items.`,
        };
      }

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .in('id', itemIds);
      updateError = error;
      break;
    }
    case 'edit_item': {
      const allowedFields = ['name', 'category', 'sku', 'operational_category'];
      if (!editField || !allowedFields.includes(editField)) {
        return {
          success: false, action, itemsAffected: 0,
          message: `I need to know which field to edit. Supported: ${allowedFields.join(', ')}. Try: "Rename [item] to [new name]" or "Change category of [item] to [category]"`,
        };
      }

      const updatePayload: Record<string, unknown> = { [editField]: value };
      const { error } = await supabase
        .from('inventory_items')
        .update(updatePayload)
        .in('id', itemIds);
      updateError = error;
      break;
    }
    case 'mark_ordered': {
      const { error } = await supabase
        .from('inventory_items')
        .update({ order_status: 'ordered' })
        .in('id', itemIds);
      updateError = error;
      break;
    }
    case 'mark_received': {
      for (const item of matchingItems) {
        const updates: Record<string, unknown> = {
          order_status: null,
          last_restock: new Date().toISOString(),
        };

        // If a quantity was specified, add it to current stock
        const receivedQty = parseInt(value) || 0;
        if (receivedQty > 0) {
          const { data: currentItem } = await supabase
            .from('inventory_items')
            .select('quantity')
            .eq('id', item.id)
            .single();
          updates.quantity = ((currentItem?.quantity as number) || 0) + receivedQty;
        }

        const { error } = await supabase
          .from('inventory_items')
          .update(updates)
          .eq('id', item.id);
        if (error) { updateError = error; break; }
      }
      break;
    }
    case 'generate_sku': {
      const { data: existingSKUs } = await supabase
        .from('inventory_items')
        .select('sku')
        .eq('org_id', orgId);

      const skuList = (existingSKUs || []).map((i: { sku: string | null }) => i.sku).filter(Boolean) as string[];

      const { data: fullItems } = await supabase
        .from('inventory_items')
        .select('id, name, category, operational_category')
        .in('id', itemIds);

      for (const item of fullItems || []) {
        const newSku = generateSKU(item.name, item.category, item.operational_category, skuList);
        skuList.push(newSku);

        const { error } = await supabase
          .from('inventory_items')
          .update({ sku: newSku })
          .eq('id', item.id);
        if (error) { updateError = error; break; }
      }
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
  } else if (action === 'delete_item') {
    successMessage = `Deleted ${matchingItems.length} item(s) from inventory`;
  } else if (action === 'edit_item') {
    successMessage = `Updated ${editField} to "${value}" for ${matchingItems.length} item(s)`;
  } else if (action === 'mark_ordered') {
    successMessage = `Marked ${matchingItems.length} item(s) as ordered`;
  } else if (action === 'mark_received') {
    successMessage = `Marked ${matchingItems.length} item(s) as received${value ? ` (+${value} units restocked)` : ''}`;
  } else if (action === 'generate_sku') {
    successMessage = `Generated SKU(s) for ${matchingItems.length} item(s)`;
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
      .select('subscription_tier, billing_exempt')
      .eq('id', orgId)
      .single();

    if (orgError || !orgData) {
      return jsonResponse(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const tier = (orgData.subscription_tier || 'free') as PlanTier;
    const billingExempt = orgData.billing_exempt || false;

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
      .select('name, sku, invoice, category, expiration_date, item_type, operational_category, order_status, quantity, reorder_threshold')
      .eq('org_id', orgId)
      .limit(100);

    const inventoryContext = inventory
      ?.map(i => `${i.name} | SKU: ${i.sku || 'N/A'} | Invoice: ${i.invoice || 'N/A'} | Category: ${i.category || 'N/A'} | Type: ${i.item_type || 'stock'}${i.operational_category ? ` (${i.operational_category})` : ''} | Qty: ${i.quantity} | Reorder: ${i.reorder_threshold} | Order: ${i.order_status || 'none'} | Expiry: ${i.expiration_date || 'Not set'}`)
      .join('\n') || 'No inventory items';

    // Parse the user's intent
    const intent = await parseActionIntent(message, inventoryContext);

    if (!intent || intent.action === 'none' || intent.confidence < 0.7) {
      return jsonResponse({
        isAction: false,
        message: 'This appears to be a question, not an action request.',
      });
    }

    // Value is required for some actions but not others
    const actionsRequiringValue = ['set_expiry', 'update_quantity', 'add_quantity', 'subtract_quantity', 'set_reorder_threshold', 'edit_item'];
    if (!intent.value && actionsRequiringValue.includes(intent.action)) {
      return jsonResponse({
        isAction: true,
        needsConfirmation: true,
        action: intent.action,
        filters: intent.filters,
        message: 'I understood you want to update items, but I need the value. For example: "Set expiry to March 30, 2026"',
      });
    }

    // Execute the action
    const result = await executeAction(
      orgId,
      intent.action,
      intent.filters,
      intent.value || '',
      intent.item_data as Record<string, unknown> | undefined,
      intent.edit_field,
      tier,
      billingExempt
    );

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
