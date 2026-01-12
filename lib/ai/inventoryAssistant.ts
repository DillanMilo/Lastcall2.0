import OpenAI from 'openai';
import { InventoryItem } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export interface StockMovement {
  item_id: string;
  item_name: string;
  sku: string | null;
  total_sold: number;
  total_restocked: number;
  avg_daily_sales: number;
  days_of_stock_left: number;
  suggested_order_qty: number;
}

/**
 * Format inventory data into a context string for the AI
 */
export function formatInventoryContext(items: InventoryItem[]): string {
  if (!items || items.length === 0) {
    return 'No inventory items found.';
  }

  // Get low stock items
  const lowStock = items.filter(item => item.quantity <= item.reorder_threshold);
  
  // Get items expiring soon (within 30 days)
  const expiringSoon = items.filter(item => {
    if (!item.expiration_date) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(item.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });

  // Format complete inventory summary
  const inventorySummary = `
CURRENT INVENTORY STATUS:
========================

Total Items: ${items.length}
Low Stock Alerts: ${lowStock.length}
Expiring Soon (30 days): ${expiringSoon.length}

COMPLETE INVENTORY LIST:
${items.map((item, idx) => `
${idx + 1}. ${item.name}
   - SKU: ${item.sku || 'N/A'}
   - Invoice: ${item.invoice || 'N/A'}
   - Current Stock: ${item.quantity} units
   - Reorder Point: ${item.reorder_threshold} units
   - Status: ${item.quantity <= item.reorder_threshold ? '🚨 LOW STOCK' : '✅ Good'}
   - Category: ${item.category || 'Uncategorized'}
   - Expiry: ${item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : 'No expiry'}
   ${item.expiration_date ? `- Days until expiry: ${Math.ceil((new Date(item.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}` : ''}
`).join('\n')}

${lowStock.length > 0 ? `
URGENT: LOW STOCK ITEMS:
${lowStock.map(item => `- ${item.name}: Only ${item.quantity} units left (reorder at ${item.reorder_threshold})`).join('\n')}
` : ''}

${expiringSoon.length > 0 ? `
EXPIRING SOON:
${expiringSoon.map(item => {
  const days = Math.ceil((new Date(item.expiration_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return `- ${item.name}: Expires in ${days} days (${new Date(item.expiration_date!).toLocaleDateString()})`;
}).join('\n')}
` : ''}
`;

  return inventorySummary;
}

/**
 * Format stock movement data into context for AI ordering recommendations
 */
export function formatStockMovementContext(movements: StockMovement[]): string {
  if (!movements || movements.length === 0) {
    return '\nSTOCK MOVEMENT DATA: No movement history available yet. Smart ordering predictions will improve as more data is collected.';
  }

  // Sort by urgency (days of stock left, ascending)
  const sorted = [...movements].sort((a, b) => a.days_of_stock_left - b.days_of_stock_left);
  
  const urgentItems = sorted.filter(m => m.days_of_stock_left <= 14);
  const moderateItems = sorted.filter(m => m.days_of_stock_left > 14 && m.days_of_stock_left <= 30);

  return `
STOCK MOVEMENT ANALYSIS (Last 4 Weeks):
=======================================

${sorted.map(m => `
📦 ${m.item_name} ${m.sku ? `(${m.sku})` : ''}
   - Units Sold (4 weeks): ${m.total_sold}
   - Avg Daily Sales: ${m.avg_daily_sales.toFixed(1)} units/day
   - Days of Stock Left: ${m.days_of_stock_left} days ${m.days_of_stock_left <= 7 ? '🚨 CRITICAL' : m.days_of_stock_left <= 14 ? '⚠️ ORDER SOON' : ''}
   - Suggested Order Qty: ${m.suggested_order_qty} units (4-week supply)
`).join('')}

${urgentItems.length > 0 ? `
🚨 URGENT ORDERS NEEDED (< 2 weeks stock):
${urgentItems.map(m => `- ${m.item_name}: Order ${m.suggested_order_qty} units NOW (only ${m.days_of_stock_left} days left)`).join('\n')}
` : ''}

${moderateItems.length > 0 ? `
⚠️ ORDER SOON (2-4 weeks stock):
${moderateItems.map(m => `- ${m.item_name}: Order ${m.suggested_order_qty} units within 1-2 weeks`).join('\n')}
` : ''}
`;
}

/**
 * Get AI-powered inventory insights and recommendations
 */
export async function getInventoryAssistantResponse(
  userMessage: string,
  inventory: InventoryItem[],
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  stockMovements?: StockMovement[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "AI assistant is not configured. Please add OPENAI_API_KEY to your environment variables.";
  }

  try {
    const inventoryContext = formatInventoryContext(inventory);
    const movementContext = stockMovements ? formatStockMovementContext(stockMovements) : '';

    const systemPrompt = `You are an expert inventory management assistant for LastCallIQ, a smart inventory system. Your role is to help users understand their stock levels, identify issues, and provide actionable SMART ORDERING recommendations based on actual sales data.

CURRENT INVENTORY DATA:
${inventoryContext}
${movementContext}

YOUR CAPABILITIES:
- **SMART ORDERING**: When asked "what should I order?" or similar, analyze stock movement data and provide specific order quantities based on actual sales velocity over the past 4 weeks
- **SET EXPIRY DATES**: You can update expiry dates! When user says "set expiry for X to [date]", the system will update those items
- **BULK UPDATES**: You can update multiple items at once by invoice, product name pattern, or category
- Calculate how many days of stock remain based on average daily sales
- Recommend order quantities that will last 4-6 weeks
- Prioritize orders by urgency (items running out soonest first)
- Identify fast-moving vs slow-moving items
- Suggest items to discontinue or put on sale if they're not selling
- Predict when items will run out based on sales trends
- Identify items expiring soon and suggest actions
- Alert about potential stockouts before they happen
- Group items by invoice/batch for bulk actions
- Compare stock across categories
- Provide daily/weekly/monthly inventory summaries

ACTION COMMANDS (tell users they can say these):
- "Set expiry for all [product name] to [date]" - Updates expiry date for matching products
- "Update invoice [INV-XXX] expiry to [date]" - Updates all items in that invoice
- "Set expiry for [category] products to [date]" - Updates by category

SMART ORDERING RULES:
1. If stock movement data is available, ALWAYS use it for ordering recommendations
2. Calculate suggested order = (avg daily sales × 28 days) + safety buffer
3. Prioritize items with < 14 days of stock as URGENT
4. Items with < 7 days of stock are CRITICAL - recommend immediate ordering
5. For slow-moving items (< 1 unit/day), suggest smaller order quantities
6. For fast-moving items (> 5 units/day), suggest larger quantities with buffer

GUIDELINES:
1. Be concise and actionable - prioritize urgent issues
2. Use specific numbers and item names from the inventory
3. Always mention invoice numbers when relevant for batch operations
4. Highlight urgent items with 🚨 and good status with ✅
5. Provide SPECIFIC recommendations (e.g., "Order 50 units of Biltong Original by Friday")
6. If asked about items not in inventory, clearly state they don't exist
7. Use bullet points for multiple recommendations
8. Calculate days of stock remaining when relevant
9. Always be helpful, friendly, and professional
10. Use emojis liberally to highlight important information
11. When giving order recommendations, format as a clear ORDER LIST

EXAMPLE SMART ORDER RESPONSE:
"📋 **RECOMMENDED ORDER** (based on last 4 weeks sales):

🚨 **ORDER NOW** (Critical - under 7 days stock):
- Angus Biltong Original 100g: Order **75 units** (selling 2.5/day, only 3 days left)
- Mixed Nuts 500g: Order **50 units** (selling 1.8/day, only 5 days left)

⚠️ **ORDER THIS WEEK** (Under 14 days stock):
- Droewors 250g: Order **40 units** (selling 1.2/day, 12 days left)

✅ **Good for 2+ weeks**:
- Chilli Bites, Peri-Peri varieties have 20+ days stock"

Always base your answers ONLY on the provided inventory and movement data. Never make up stock levels or sales figures.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantMessage = response.choices[0]?.message?.content;

    if (!assistantMessage) {
      return "I'm having trouble generating a response. Please try again.";
    }

    return assistantMessage;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to get AI response';
    console.error('Error getting AI response:', error);
    return `Error: ${message}`;
  }
}

/**
 * Get quick insights about inventory
 */
export function getQuickInsights(items: InventoryItem[]): {
  totalItems: number;
  lowStockCount: number;
  criticalItems: string[];
  expiringThisWeek: string[];
  topRecommendations: string[];
} {
  const lowStock = items.filter(item => item.quantity <= item.reorder_threshold);
  const critical = items.filter(item => item.quantity < item.reorder_threshold * 0.5);
  
  const expiringThisWeek = items.filter(item => {
    if (!item.expiration_date) return false;
    const days = Math.ceil((new Date(item.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 7;
  });

  const recommendations: string[] = [];
  
  if (critical.length > 0) {
    recommendations.push(`🚨 ${critical.length} item(s) critically low - order immediately`);
  }
  
  if (expiringThisWeek.length > 0) {
    recommendations.push(`⏰ ${expiringThisWeek.length} item(s) expiring this week`);
  }
  
  if (lowStock.length > critical.length) {
    recommendations.push(`⚠️ ${lowStock.length - critical.length} item(s) approaching reorder point`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All inventory levels look good!');
  }

  return {
    totalItems: items.length,
    lowStockCount: lowStock.length,
    criticalItems: critical.map(i => i.name),
    expiringThisWeek: expiringThisWeek.map(i => i.name),
    topRecommendations: recommendations,
  };
}
