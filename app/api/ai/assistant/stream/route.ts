import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createStreamingResponse, getFallbackResponse } from '@/lib/ai/streamingAssistant';
import { StockMovement } from '@/lib/ai/inventoryAssistant';
import { InventoryItem } from '@/types';
import { checkAIRequestLimit, logAIRequest } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';
import { checkRateLimit, RATE_LIMITS } from '@/lib/utils/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Detect if a user message is an action request using flexible pattern matching.
 * Uses regex patterns that allow natural phrasing like "create a SKU", "add some cleaning items", etc.
 */
function detectActionIntent(message: string): boolean {
  const lower = message.toLowerCase();

  // Exact phrase matches (high confidence, no flexibility needed)
  const exactPhrases = [
    'reorder level', 'reorder threshold', 'restock',
    'apply recommend', 'use recommend',
    'rename', 'order placed', 'received shipment', 'delivery received',
  ];
  if (exactPhrases.some(phrase => lower.includes(phrase))) return true;

  // Regex patterns that allow words in between (e.g., "create a new SKU", "add 50 cleaning items")
  const actionPatterns = [
    // Mark ordered/received - "mark + (item name) + as ordered/received"
    /\bmark\b.{0,30}\b(ordered|received)\b/,
    // SKU operations - "create/generate/assign/add/enter/make + (any words) + sku(s)"
    /\b(create|generate|assign|add|enter|make|give|set up)\b.{0,30}\bskus?\b/,
    /\bskus?\b.{0,20}\b(for|to|on)\b/,
    // Add/create items - "add/create + (any words) + item(s)/product(s)/inventory"
    /\b(add|create|enter|new|register)\b.{0,30}\b(items?|products?|inventory|to inventory)\b/,
    // Add with quantities - "add 50 paper towels" (add + number + item name)
    /\b(add|create)\b\s+\d+\s+\w/,
    // Operational items - "add/create + (any words) + operational/cleaning/office/kitchen/etc"
    /\b(add|create|enter|new)\b.{0,40}\b(operational|cleaning|office|kitchen|packaging|tableware|maintenance|safety)\b/,
    // Delete/remove items
    /\b(delete|remove)\b.{0,30}\b(items?|products?|from inventory|the)\b/,
    // Edit items - "change/update/edit + (any words) + name/category/sku"
    /\b(change|update|edit|modify)\b.{0,30}\b(name|category|sku|categories)\b/,
    // Set/update expiry
    /\b(set|update|change)\b.{0,20}\b(expiry|expiration|expire)\b/,
    // Set/update reorder
    /\b(set|update|change)\b.{0,20}\breorder\b/,
    // Quantity operations - "set/update/change + (any words) + quantity"
    /\b(set|update|change)\b.{0,20}\bquantit/,
    /\b(add|subtract|remove)\b.{0,20}\b(quantity|units|stock)\b/,
    // Received stock - "received + number" or "received + item"
    /\breceived\b\s+\d/,
    /\breceived\b.{0,20}\b(units|shipment|delivery|order)\b/,
    // Bulk operations
    /\b(set|update)\s+all\b/,
  ];

  return actionPatterns.some(pattern => pattern.test(lower));
}

/**
 * Calculate stock movements from inventory history
 */
async function getStockMovements(orgId: string): Promise<StockMovement[]> {
  if (!serviceRoleKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const { data: history, error } = await supabase
    .from('inventory_history')
    .select('item_id, item_name, sku, quantity_change, created_at')
    .eq('org_id', orgId)
    .gte('created_at', fourWeeksAgo.toISOString())
    .order('created_at', { ascending: true });

  if (error || !history || history.length === 0) {
    return [];
  }

  const { data: inventory } = await supabase
    .from('inventory_items')
    .select('id, name, sku, quantity')
    .eq('org_id', orgId);

  if (!inventory) {
    return [];
  }

  const movementsByItem = new Map<string, {
    item_name: string;
    sku: string | null;
    total_sold: number;
    total_restocked: number;
    current_qty: number;
  }>();

  for (const item of inventory) {
    movementsByItem.set(item.id, {
      item_name: item.name,
      sku: item.sku,
      total_sold: 0,
      total_restocked: 0,
      current_qty: item.quantity,
    });
  }

  for (const h of history) {
    const existing = movementsByItem.get(h.item_id);
    if (existing) {
      if (h.quantity_change < 0) {
        existing.total_sold += Math.abs(h.quantity_change);
      } else {
        existing.total_restocked += h.quantity_change;
      }
    }
  }

  const movements: StockMovement[] = [];
  const daysOfData = 28;

  for (const [itemId, data] of movementsByItem) {
    const avgDailySales = data.total_sold / daysOfData;
    const daysOfStockLeft = avgDailySales > 0
      ? Math.floor(data.current_qty / avgDailySales)
      : 999;

    const suggestedOrderQty = Math.ceil(avgDailySales * 28 * 1.2);

    movements.push({
      item_id: itemId,
      item_name: data.item_name,
      sku: data.sku,
      total_sold: data.total_sold,
      total_restocked: data.total_restocked,
      avg_daily_sales: avgDailySales,
      days_of_stock_left: daysOfStockLeft,
      suggested_order_qty: suggestedOrderQty,
    });
  }

  return movements.filter(m => m.total_sold > 0).sort((a, b) => a.days_of_stock_left - b.days_of_stock_left);
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { message, orgId, userName, conversationHistory } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit AI assistant requests
    if (orgId) {
      const rateCheck = checkRateLimit(`ai:${orgId}`, RATE_LIMITS.ai);
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get organization tier
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier, billing_exempt')
      .eq('id', orgId)
      .single();

    if (orgError || !orgData) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tier = (orgData.subscription_tier || 'free') as PlanTier;
    const billingExempt = orgData.billing_exempt || false;

    // Check AI request limit
    const limitCheck = await checkAIRequestLimit(supabase, orgId, tier, billingExempt);
    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'AI request limit reached',
          message: limitCheck.message,
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
          upgradeRequired: true,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current inventory (limit to 5000 items to prevent timeout)
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('org_id', orgId)
      .limit(5000);

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch inventory data. Please refresh and try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is an action request using flexible pattern matching
    const isLikelyAction = detectActionIntent(message);

    if (isLikelyAction) {
      try {
        const actionResponse = await fetch(new URL('/api/ai/action', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({ message, orgId }),
        });

        const actionData = await actionResponse.json();

        if (actionData.isAction && actionData.success) {
          const actionMessage = `✅ **Action Completed!**\n\n${actionData.message}\n\n**Items updated:**\n${actionData.details?.map((d: string) => `• ${d}`).join('\n') || 'See inventory for details'}`;

          // Log the AI request
          await logAIRequest(supabase, orgId, 'action');

          // Return as non-streaming response for actions
          return new Response(
            JSON.stringify({
              success: true,
              response: actionMessage,
              timestamp: new Date().toISOString(),
              actionExecuted: true,
              streaming: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        } else if (actionData.isAction && !actionData.success) {
          return new Response(
            JSON.stringify({
              success: true,
              response: `⚠️ I understood you want to update inventory, but: ${actionData.message}\n\nPlease try being more specific, for example:\n• "Set expiry for all Biltong products to March 30, 2026"\n• "Update invoice INV-123 expiry to June 2026"`,
              timestamp: new Date().toISOString(),
              streaming: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (actionError) {
        console.error('Action processing error:', actionError);
      }
    }

    // Fetch stock movements
    const stockMovements = await getStockMovements(orgId);

    // Log the AI request
    await logAIRequest(supabase, orgId, 'assistant');

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = createStreamingResponse(
            message,
            inventory as InventoryItem[],
            conversationHistory || [],
            stockMovements.length > 0 ? stockMovements : undefined,
            userName
          );

          for await (const chunk of generator) {
            // Send each chunk as a Server-Sent Event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, hasMovementData: stockMovements.length > 0 })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          // Send error as final message
          const errorMessage = getFallbackResponse(message, inventory as InventoryItem[]);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: errorMessage, error: true })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('Error in streaming AI assistant API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({
        error: 'Something went wrong',
        message: errorMessage,
        suggestion: 'Please try again. If the problem persists, try refreshing the page.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
