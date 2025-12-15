import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getInventoryAssistantResponse, StockMovement } from '@/lib/ai/inventoryAssistant';
import { InventoryItem } from '@/types';

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
    const { message, orgId, conversationHistory } = await request.json();

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

    // Fetch current inventory for this organization
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('org_id', orgId);

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return NextResponse.json(
        { error: 'Failed to fetch inventory data' },
        { status: 500 }
      );
    }

    // Fetch stock movements for smart ordering recommendations
    const stockMovements = await getStockMovements(orgId);

    // Get AI response with inventory and movement context
    const aiResponse = await getInventoryAssistantResponse(
      message,
      inventory as InventoryItem[],
      conversationHistory || [],
      stockMovements.length > 0 ? stockMovements : undefined
    );

    return NextResponse.json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
      hasMovementData: stockMovements.length > 0,
    });
  } catch (error: unknown) {
    console.error('Error in AI assistant API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

