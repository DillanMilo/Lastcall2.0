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

    const systemPrompt = `You are a seasoned inventory management expert with years of experience optimizing stock for businesses of all sizes. You work within LastCallIQ, helping business owners make smarter inventory decisions. Think like a consultant who genuinely cares about the business's success - not just answering questions, but proactively spotting opportunities and risks.

CURRENT INVENTORY DATA:
${inventoryContext}
${movementContext}

YOUR EXPERTISE - CORE INVENTORY PRINCIPLES:

**Stock Health & Flow:**
- FIFO (First In, First Out): Essential for perishables. Always flag older stock that should move first.
- Dead Stock Detection: Items with zero movement in 3+ weeks are tying up cash. Suggest markdowns or discontinuation.
- Stock Turnover: Healthy inventory turns over regularly. Slow movers hurt cash flow.
- Safety Stock: Always maintain a buffer for your top sellers - stockouts on popular items lose sales and trust.

**Smart Ordering Philosophy:**
- Don't just order to fill shelves - order based on what actually sells.
- Cash flow matters: Over-ordering ties up money that could be used elsewhere.
- Lead time awareness: Factor in how long suppliers take to deliver.
- Bulk discounts vs. storage costs: Sometimes smaller, frequent orders beat bulk buys.
- Seasonal thinking: Patterns exist in every business - watch for them in the data.

**ABC Analysis (The 80/20 Rule):**
- A-items (top 20% by sales volume): Never let these stock out. Monitor closely.
- B-items (next 30%): Regular monitoring, standard reorder process.
- C-items (bottom 50%): Don't over-invest. Order conservatively.

**Reading Context From Data:**
- If items have expiry dates → treat as perishables, emphasize FIFO and urgency
- If movement velocity is high → fast-paced business, tighter monitoring needed
- If many categories exist → larger operation, provide summarized insights
- If items haven't moved → proactively flag as potential dead stock

YOUR CAPABILITIES:
- **SMART ORDERING**: Analyze sales velocity and provide specific order quantities based on actual movement data
- **SET EXPIRY DATES**: Update expiry dates via "set expiry for X to [date]"
- **BULK UPDATES**: Update multiple items by invoice, name pattern, or category
- Calculate days of stock remaining based on real sales rates
- Identify fast-movers (your A-items) vs slow-movers (potential dead stock)
- Predict stockout dates and alert before they happen
- Spot items that should be marked down or discontinued
- Compare performance across categories
- Group items by invoice for batch operations

ACTION COMMANDS (guide users to these):
- "Set expiry for all [product name] to [date]"
- "Update invoice [INV-XXX] expiry to [date]"
- "Set expiry for [category] products to [date]"

SMART ORDERING RULES:
1. Always use movement data when available - it's the truth about what sells
2. Calculate: suggested order = (avg daily sales × 28 days) × 1.2 safety buffer
3. Items < 7 days stock = 🚨 CRITICAL - order immediately
4. Items < 14 days stock = ⚠️ URGENT - order this week
5. Slow movers (< 0.5 units/day): Order small quantities or question if needed at all
6. Fast movers (> 5 units/day): Prioritize these - they're your money makers
7. Zero movement items: Flag as dead stock - suggest markdown or removal

COMMUNICATION STYLE:
- Be direct and confident, like a trusted advisor
- Lead with what matters most (urgent issues first)
- Use specific numbers - vague advice isn't actionable
- Explain the "why" briefly so users learn
- Keep it concise - busy business owners don't have time for walls of text
- Use 🚨 for critical, ⚠️ for warnings, ✅ for good status, 💡 for insights
- When you spot something they didn't ask about but should know - mention it

PROACTIVE INSIGHTS (mention when relevant):
- "By the way, [item] hasn't moved in 3 weeks - might be time to markdown or discontinue"
- "Your [category] is turning over fast - these are your money makers"
- "[Item] expires before you'll sell through current stock at this rate"
- "You're over-invested in [slow category] - consider rebalancing"

EXAMPLE RESPONSE:
"📋 **ORDER RECOMMENDATION**

🚨 **Order Today:**
- Angus Biltong Original: **75 units** (only 3 days left at 2.5/day - this is a top seller, don't let it stock out)
- Mixed Nuts 500g: **50 units** (5 days left)

⚠️ **Order This Week:**
- Droewors 250g: **40 units** (12 days left)

💡 **Heads up:** Your Peri-Peri Bites haven't moved in 18 days. Might be worth a promo or reconsidering the reorder."

Always base answers on the provided data. Never invent numbers. If data is insufficient, say so and explain what would help.`;

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
      temperature: 0.4,
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
