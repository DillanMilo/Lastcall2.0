import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StockMovement } from '@/lib/ai/inventoryAssistant';
import { getImprovedAssistantResponse, getFallbackResponse } from '@/lib/ai/streamingAssistant';
import { InventoryItem } from '@/types';
import { checkAIRequestLimit, logAIRequest } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

  // Try to get stock movement data from inventory_history table
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const { data: history, error } = await supabase
    .from('inventory_history')
    .select('item_id, item_name, sku, quantity_change, created_at')
    .eq('org_id', orgId)
    .gte('created_at', fourWeeksAgo.toISOString())
    .order('created_at', { ascending: true });

  if (error || !history || history.length === 0) {
    // Table might not exist yet or no data - return empty
    return [];
  }

  // Get current inventory quantities
  const { data: inventory } = await supabase
    .from('inventory_items')
    .select('id, name, sku, quantity')
    .eq('org_id', orgId);

  if (!inventory) {
    return [];
  }

  // Calculate movements per item
  const movementsByItem = new Map<string, {
    item_name: string;
    sku: string | null;
    total_sold: number;
    total_restocked: number;
    current_qty: number;
  }>();

  // Initialize with current inventory
  for (const item of inventory) {
    movementsByItem.set(item.id, {
      item_name: item.name,
      sku: item.sku,
      total_sold: 0,
      total_restocked: 0,
      current_qty: item.quantity,
    });
  }

  // Process history
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

  // Calculate metrics
  const movements: StockMovement[] = [];
  const daysOfData = 28; // 4 weeks

  for (const [itemId, data] of movementsByItem) {
    const avgDailySales = data.total_sold / daysOfData;
    const daysOfStockLeft = avgDailySales > 0 
      ? Math.floor(data.current_qty / avgDailySales) 
      : 999; // Infinity for non-moving items
    
    // Suggest 4-week supply plus 20% buffer
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

  // Sort by urgency (days of stock left)
  return movements.filter(m => m.total_sold > 0).sort((a, b) => a.days_of_stock_left - b.days_of_stock_left);
}

export async function POST(request: NextRequest) {
  try {
    const { message, orgId, userName, conversationHistory } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get organization tier for limit checking
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier, billing_exempt')
      .eq('id', orgId)
      .single();

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: 'Organization not found. Please refresh the page and try again.' },
        { status: 404 }
      );
    }

    const tier = (orgData.subscription_tier || 'free') as PlanTier;
    const billingExempt = orgData.billing_exempt || false;

    // Check AI request limit
    const limitCheck = await checkAIRequestLimit(supabase, orgId, tier, billingExempt);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'AI request limit reached',
          message: limitCheck.message,
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
          upgradeRequired: true,
          suggestion: 'Upgrade your plan to get more AI requests, or wait until next month when your quota resets.',
        },
        { status: 403 }
      );
    }

    // Fetch current inventory for this organization
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('org_id', orgId);

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return NextResponse.json(
        {
          error: 'Failed to fetch inventory data',
          message: 'Unable to load your inventory. Please refresh the page and try again.',
          suggestion: 'If this problem persists, check your internet connection.',
        },
        { status: 500 }
      );
    }

    // Fetch stock movements for smart ordering recommendations
    const stockMovements = await getStockMovements(orgId);

    // Check if this is an action request (setting expiry, updating quantities, reorder levels, etc.)
    const actionKeywords = [
      // Expiry
      'set expiry', 'set expiration', 'update expiry', 'change expiry',
      // Reorder
      'set reorder', 'update reorder', 'change reorder', 'reorder level', 'reorder threshold',
      // Quantity
      'set quantity', 'update quantity', 'change quantity',
      'add quantity', 'subtract quantity', 'remove quantity',
      'received', 'restock',
      // Bulk
      'set all', 'update all', 'apply recommend', 'use recommend',
      // Add/create item
      'add item', 'create item', 'add new', 'create new', 'add a new', 'new item',
      'add product', 'create product',
      // Delete item
      'delete item', 'remove item', 'delete the', 'remove the',
      // Edit item
      'edit item', 'change name', 'rename', 'change category', 'update category',
      'change sku', 'update sku', 'edit the',
      // Order status
      'mark ordered', 'mark as ordered', 'mark received', 'mark as received',
      'order placed', 'received shipment', 'delivery received',
      // SKU generation
      'generate sku', 'create sku', 'assign sku', 'auto sku',
    ];
    const isLikelyAction = actionKeywords.some(keyword =>
      message.toLowerCase().includes(keyword)
    );

    if (isLikelyAction) {
      // Try to execute as an action
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
          // Action was executed successfully
          const actionMessage = `✅ **Action Completed!**\n\n${actionData.message}\n\n**Items updated:**\n${actionData.details?.map((d: string) => `• ${d}`).join('\n') || 'See inventory for details'}`;
          
          return NextResponse.json({
            success: true,
            response: actionMessage,
            timestamp: new Date().toISOString(),
            actionExecuted: true,
          });
        } else if (actionData.isAction && !actionData.success) {
          // Action was recognized but failed
          return NextResponse.json({
            success: true,
            response: `⚠️ I understood you want to update inventory, but: ${actionData.message}\n\nPlease try being more specific, for example:\n• "Set expiry for all Biltong products to March 30, 2026"\n• "Update invoice INV-123 expiry to June 2026"`,
            timestamp: new Date().toISOString(),
          });
        }
        // If not an action, fall through to regular AI response
      } catch (actionError) {
        console.error('Action processing error:', actionError);
        // Fall through to regular AI response
      }
    }

    // Log the AI request for usage tracking
    await logAIRequest(supabase, orgId, 'assistant');

    // Get AI response with inventory and movement context (with fallback support)
    const { response: aiResponse, usedFallback } = await getImprovedAssistantResponse(
      message,
      inventory as InventoryItem[],
      conversationHistory || [],
      stockMovements.length > 0 ? stockMovements : undefined,
      userName
    );

    return NextResponse.json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
      hasMovementData: stockMovements.length > 0,
      usedFallback,
    });
  } catch (error: unknown) {
    console.error('Error in AI assistant API:', error);

    // Try to provide a fallback response
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const body = await request.clone().json().catch(() => ({}));
      const { message, orgId } = body;

      if (message && orgId) {
        const { data: inventory } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('org_id', orgId);

        if (inventory) {
          const fallback = getFallbackResponse(message, inventory as InventoryItem[]);
          return NextResponse.json({
            success: true,
            response: fallback,
            timestamp: new Date().toISOString(),
            usedFallback: true,
          });
        }
      }
    } catch {
      // Ignore fallback errors
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        error: 'Something went wrong',
        message: errorMessage,
        suggestion: 'Please try again. If the problem persists, try refreshing the page.',
      },
      { status: 500 }
    );
  }
}

