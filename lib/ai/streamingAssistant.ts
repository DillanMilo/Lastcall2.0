import OpenAI from 'openai';
import { InventoryItem } from '@/types';
import { formatInventoryContext, formatStockMovementContext, StockMovement } from './inventoryAssistant';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Error types for better error handling
export type AIErrorType =
  | 'api_key_missing'
  | 'rate_limit'
  | 'timeout'
  | 'network_error'
  | 'service_unavailable'
  | 'invalid_response'
  | 'unknown';

export interface AIError {
  type: AIErrorType;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

// Parse OpenAI errors into user-friendly messages
export function parseOpenAIError(error: unknown): AIError {
  if (error instanceof OpenAI.APIError) {
    switch (error.status) {
      case 401:
        return {
          type: 'api_key_missing',
          message: 'AI service is not properly configured. Please contact support.',
          retryable: false,
        };
      case 429:
        const retryAfter = error.headers?.['retry-after'];
        return {
          type: 'rate_limit',
          message: 'AI service is temporarily busy. Please wait a moment and try again.',
          retryable: true,
          retryAfterMs: retryAfter ? parseInt(retryAfter) * 1000 : 5000,
        };
      case 500:
      case 502:
      case 503:
        return {
          type: 'service_unavailable',
          message: 'AI service is temporarily unavailable. Using offline mode.',
          retryable: true,
          retryAfterMs: 10000,
        };
      case 408:
        return {
          type: 'timeout',
          message: 'Request took too long. Please try a shorter question.',
          retryable: true,
          retryAfterMs: 2000,
        };
      default:
        return {
          type: 'unknown',
          message: `AI service error: ${error.message}`,
          retryable: false,
        };
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') || error.message.includes('fetch failed')) {
      return {
        type: 'network_error',
        message: 'Unable to connect to AI service. Check your internet connection.',
        retryable: true,
        retryAfterMs: 3000,
      };
    }
  }

  return {
    type: 'unknown',
    message: 'An unexpected error occurred. Please try again.',
    retryable: true,
    retryAfterMs: 2000,
  };
}

// Fallback responses when AI is unavailable
export function getFallbackResponse(userMessage: string, inventory: InventoryItem[]): string {
  const lowerMessage = userMessage.toLowerCase();

  // Low stock query
  if (lowerMessage.includes('low stock') || lowerMessage.includes('reorder') || lowerMessage.includes('running low')) {
    const lowStock = inventory.filter(item => item.quantity <= item.reorder_threshold);
    if (lowStock.length === 0) {
      return "✅ **Good news!** All your inventory items are above their reorder thresholds.\n\n*Note: AI service is temporarily unavailable. This is a basic analysis.*";
    }
    const items = lowStock.slice(0, 10).map(item =>
      `- **${item.name}**: ${item.quantity} units (reorder at ${item.reorder_threshold})`
    ).join('\n');
    return `🚨 **Low Stock Alert** (${lowStock.length} items)\n\n${items}${lowStock.length > 10 ? `\n\n...and ${lowStock.length - 10} more items` : ''}\n\n*Note: AI service is temporarily unavailable. This is a basic analysis.*`;
  }

  // Expiring query
  if (lowerMessage.includes('expir') || lowerMessage.includes('expire') || lowerMessage.includes('expiry')) {
    const expiring = inventory.filter(item => {
      if (!item.expiration_date) return false;
      const days = Math.ceil((new Date(item.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 30;
    });
    if (expiring.length === 0) {
      return "✅ **No items expiring in the next 30 days.**\n\n*Note: AI service is temporarily unavailable. This is a basic analysis.*";
    }
    const items = expiring.slice(0, 10).map(item => {
      const days = Math.ceil((new Date(item.expiration_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return `- **${item.name}**: expires in ${days} days`;
    }).join('\n');
    return `⏰ **Expiring Soon** (${expiring.length} items)\n\n${items}\n\n*Note: AI service is temporarily unavailable. This is a basic analysis.*`;
  }

  // Summary/overview query
  if (lowerMessage.includes('summary') || lowerMessage.includes('overview') || lowerMessage.includes('status')) {
    const lowStock = inventory.filter(item => item.quantity <= item.reorder_threshold);
    const expiring = inventory.filter(item => {
      if (!item.expiration_date) return false;
      const days = Math.ceil((new Date(item.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 30;
    });
    return `📊 **Inventory Summary**\n\n- **Total Items:** ${inventory.length}\n- **Low Stock:** ${lowStock.length} items\n- **Expiring Soon:** ${expiring.length} items\n\n*Note: AI service is temporarily unavailable. This is a basic analysis.*`;
  }

  // Sales report query
  if (lowerMessage.includes('report') || lowerMessage.includes('sales summary') || lowerMessage.includes('performance')) {
    const lowStock = inventory.filter(item => item.quantity <= item.reorder_threshold);
    return `📊 **Quick Inventory Report**\n\n- **Total Items:** ${inventory.length}\n- **Low Stock:** ${lowStock.length} items\n- **Categories:** ${new Set(inventory.map(i => i.category || 'Uncategorized')).size}\n\nFor detailed daily/weekly/monthly/quarterly sales reports, use the report buttons below or ask "Give me a weekly sales report".\n\n*Note: AI service is temporarily unavailable. This is a basic analysis.*`;
  }

  // Order recommendation
  if (lowerMessage.includes('order') || lowerMessage.includes('what should i')) {
    const lowStock = inventory.filter(item => item.quantity <= item.reorder_threshold);
    if (lowStock.length === 0) {
      return "✅ **No urgent orders needed** - all items are above reorder levels.\n\n*Note: AI service is temporarily unavailable. This is a basic analysis.*";
    }
    const items = lowStock.slice(0, 5).map(item =>
      `- **${item.name}**: Currently ${item.quantity} units`
    ).join('\n');
    return `📋 **Items to Consider Ordering:**\n\n${items}\n\n*Note: AI service is temporarily unavailable. For detailed order quantities based on sales velocity, please try again when the service is back online.*`;
  }

  // Default fallback
  return `⚠️ **AI service is temporarily unavailable.**\n\nI can still help with basic queries:\n- "What's low stock?"\n- "What's expiring soon?"\n- "Give me a summary"\n- "What should I order?"\n\nPlease try your question again in a moment, or use one of these basic queries.`;
}

// Summarize older conversation history to save tokens
export function summarizeConversationHistory(
  history: { role: 'user' | 'assistant'; content: string }[]
): { role: 'user' | 'assistant'; content: string }[] {
  if (history.length <= 10) {
    return history; // No need to summarize
  }

  // Keep the last 10 messages as-is
  const recentMessages = history.slice(-10);

  // Summarize older messages into a single context message
  const olderMessages = history.slice(0, -10);

  // Extract key information from older messages
  const userQueries = olderMessages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .slice(-5); // Last 5 user queries from older history

  const topicsDiscussed = new Set<string>();

  for (const msg of olderMessages) {
    const content = msg.content.toLowerCase();
    if (content.includes('expir')) topicsDiscussed.add('expiration dates');
    if (content.includes('reorder') || content.includes('order')) topicsDiscussed.add('ordering');
    if (content.includes('low stock')) topicsDiscussed.add('low stock');
    if (content.includes('invoice') || content.includes('batch')) topicsDiscussed.add('invoices/batches');
    if (content.includes('categor')) topicsDiscussed.add('categories');
  }

  const summary: { role: 'user' | 'assistant'; content: string } = {
    role: 'assistant',
    content: `[Earlier in this conversation, we discussed: ${Array.from(topicsDiscussed).join(', ') || 'general inventory questions'}. User previously asked about: ${userQueries.join('; ') || 'various inventory topics'}.]`,
  };

  return [summary, ...recentMessages];
}

// Build the system prompt
export function buildSystemPrompt(
  inventoryContext: string,
  movementContext: string,
  userName?: string
): string {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

  const userGreeting = userName
    ? `The user's name is ${userName}. Address them by name naturally in conversation — use it occasionally to keep things personal, but don't overdo it.\n\n`
    : '';

  return `${userGreeting}You are a seasoned inventory management expert with years of experience optimizing stock for businesses of all sizes. You work within LastCallIQ, helping business owners make smarter inventory decisions. Think like a consultant who genuinely cares about the business's success - not just answering questions, but proactively spotting opportunities and risks.

TODAY'S DATE: ${today}

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

STOCK vs OPERATIONAL ITEMS:
The inventory has two types:
- **Stock items** (item_type: 'stock'): Products for sale - synced with POS systems. Track sales velocity, ordering recommendations, ABC analysis.
- **Operational items** (item_type: 'operational'): Back-of-house supplies NOT synced with POS. Categories: cleaning, office, kitchen, packaging, tableware, maintenance, safety, other.
When users add items, infer item_type from context:
- Cleaning supplies, office supplies, kitchen supplies, packaging, tableware → operational
- User says "operational" explicitly → operational
- Products for sale, food items, beverages → stock
- If unclear, default to stock

YOUR CAPABILITIES:
- **SMART ORDERING**: Analyze sales velocity and provide specific order quantities based on actual movement data
- **REORDER LEVEL OPTIMIZATION**: Recommend and set optimal reorder points based on sales velocity and lead times
- **SALES REPORTS**: Generate daily, weekly, monthly, and quarterly sales reports based on stock movement data
- **INVOICE/BATCH LOOKUP**: Look up all items from a specific invoice or batch - show what's in it, quantities, expiry dates
- **SET EXPIRY DATES**: Update expiry dates via "set expiry for X to [date]"
- **SET REORDER LEVELS**: Update reorder thresholds via "set reorder level for X to [number]"
- **BULK UPDATES**: Update multiple items by invoice, name pattern, or category
- **ADD ITEMS**: Create new inventory items via chat: "Add 50 Paper Towels as operational cleaning item" or "Create new item: Angus Biltong, category Snacks, 100 units"
- **DELETE ITEMS**: Remove items: "Delete the expired Biltong" or "Remove item SKU CLN-PAPTOW-001"
- **EDIT ITEMS**: Change details: "Rename Biltong 100g to Angus Biltong Original 100g" or "Change the category of Droewors to Meat Snacks"
- **GENERATE SKUs**: Auto-generate smart SKUs: "Generate SKU for Paper Towels" or "Assign SKUs to all items without one"
- **MARK ORDERED**: Track orders placed with suppliers: "Mark all low stock items as ordered" or "Mark Biltong as ordered"
- **MARK RECEIVED**: Record deliveries: "Mark Biltong as received with 100 units" or "Received shipment for invoice INV-123"
- Calculate days of stock remaining based on real sales rates
- Identify fast-movers (your A-items) vs slow-movers (potential dead stock)
- Predict stockout dates and alert before they happen
- Spot items that should be marked down or discontinued
- Compare performance across categories
- Group items by invoice for batch operations

SKU FORMAT:
When creating items or generating SKUs, the system uses: {CATEGORY_PREFIX}-{NAME_ABBR}-{SEQUENCE}
Examples: SNK-ANGBLT-001, CLN-PAPTOW-001, BEV-COLZER-001. These are auto-generated.

SALES REPORTS:
When users ask for sales reports, summaries, or performance data for specific time periods:
- Daily report: Today's sales activity, quick check-in
- Weekly report: Last 7 days, week-over-week trends
- Monthly report: Last 30 days, comprehensive analysis
- Quarterly report: Last 90 days, strategic overview with ABC analysis
- Custom date range: Any specific date or date range the user asks about

The system will automatically generate detailed reports with top sellers, slow movers, dead stock, category breakdowns, and actionable recommendations.

When Clover POS or BigCommerce is connected, reports include REAL SALES DATA from actual completed transactions — order counts and accurate per-item unit sales. This is more accurate than inventory movement estimates alone.
IMPORTANT: Never display or estimate dollar amounts, revenue, or pricing in reports. Only report on units sold and moved.

Users can ask things like:
- "Give me a daily sales report"
- "Weekly sales summary"
- "Monthly report"
- "Quarterly performance review"
- "How did we do this week?"
- "Show me this month's sales"
- "What were sales on February 10th?"
- "Sales from February 1 to February 15"
- "How did last Monday go?"
- "Show me yesterday's sales"
- "Sales for the first two weeks of January"

INVOICE/BATCH QUERIES:
When users ask about a specific invoice or batch:
1. Search the inventory data for items matching that invoice number
2. Present a clear summary: item names, quantities, SKUs, expiry dates
3. Calculate total units in that batch
4. Flag any items from that batch that are low stock or expiring soon
5. Offer relevant actions: "Want me to set expiry for all items in this invoice?"

Example queries you can handle:
- "What's in invoice INV-123?" → List all items from that invoice
- "Show me batch ABC" → Same as invoice lookup
- "How much stock from invoice INV-456?" → Sum quantities from that invoice
- "Set expiry for invoice INV-789 to June 2026" → Update all items in that invoice

ACTION COMMANDS (guide users to these):
- "Set reorder level for [product name] to [number]"
- "Set reorder threshold for all [category] to [number]"
- "Update reorder level for SKU [XXX] to [number]"
- "Set expiry for all [product name] to [date]"
- "Update invoice [INV-XXX] expiry to [date]"
- "Set expiry for [category] products to [date]"
- "Add 50 [product name] as [stock/operational] item"
- "Create new item: [name], category [X], [N] units"
- "Delete [item name]" or "Remove [item name]"
- "Rename [item] to [new name]"
- "Change category of [item] to [new category]"
- "Mark [item] as ordered"
- "Mark [item] as received with [N] units"
- "Generate SKU for [item]"
- "Assign SKUs to all items without one"

REORDER LEVEL OPTIMIZATION RULES:
When recommending or setting reorder levels, use this formula based on movement data:
1. **Optimal Reorder Point** = (Avg Daily Sales × Lead Time Days) + Safety Stock
2. **Safety Stock** = Avg Daily Sales × 3-7 days (3 for slow movers, 7 for fast movers)
3. **Lead Time**: If unknown, assume 5-7 days for most suppliers

Specific guidelines by sales velocity:
- **Fast movers (>3 units/day)**: Reorder point = 14-21 days of stock (higher buffer to prevent stockouts)
- **Medium movers (1-3 units/day)**: Reorder point = 10-14 days of stock
- **Slow movers (<1 unit/day)**: Reorder point = 7-10 days of stock (don't tie up cash)
- **Very slow (<0.2 units/day)**: Reorder point = 3-5 units max (question if needed at all)

When users ask about reorder levels:
1. Analyze their movement data to calculate optimal levels
2. Present recommendations in a clear table format
3. Explain WHY each level makes sense (based on their actual sales)
4. Offer to SET the levels for them with the action command
5. Flag any items where current reorder level is way off (too high = cash tied up, too low = stockout risk)

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

Always base answers on the provided data. Never invent numbers. If data is insufficient, say so and explain what would help.

CRITICAL RULE - NEVER CLAIM TO HAVE PERFORMED ACTIONS:
You are a CONVERSATIONAL assistant. You CANNOT directly create items, generate SKUs, delete items, update quantities, set expiry dates, or modify the database in any way. Those actions are handled by a separate action system that activates when users use specific command phrases.

If a user asks you to create an item, add a SKU, delete something, update quantities, or perform ANY inventory modification:
1. Do NOT say "I've created...", "Done!", "I've added...", "SKU generated...", or anything that implies you performed the action
2. Instead, guide them to use the correct command phrasing so the action system can handle it
3. Suggest the exact phrase they should type, for example:
   - To add an item: "Add [name] with [quantity] units" or "Create new item: [name], category [X], [N] units"
   - To add an operational item: "Add [name] as operational [category] item with [N] units"
   - To generate a SKU: "Generate SKU for [item name]"
   - To delete: "Delete [item name]"
   - To update quantity: "Set quantity of [item] to [number]" or "Add [number] units to [item]"

You can ANALYZE inventory, RECOMMEND actions, ANSWER QUESTIONS, and provide insights - but you must NEVER claim to have modified inventory data.`;

}

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const parsedError = parseOpenAIError(error);

      // Don't retry non-retryable errors
      if (!parsedError.retryable) {
        throw error;
      }

      // Wait before retrying
      const delayMs = parsedError.retryAfterMs || (baseDelayMs * Math.pow(2, attempt));
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// Create streaming response
export async function* createStreamingResponse(
  userMessage: string,
  inventory: InventoryItem[],
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  stockMovements?: StockMovement[],
  userName?: string
): AsyncGenerator<string, void, unknown> {
  if (!process.env.OPENAI_API_KEY) {
    yield "AI assistant is not configured. Please add OPENAI_API_KEY to your environment variables.";
    return;
  }

  try {
    const inventoryContext = formatInventoryContext(inventory);
    const movementContext = stockMovements ? formatStockMovementContext(stockMovements) : '';
    const systemPrompt = buildSystemPrompt(inventoryContext, movementContext, userName);

    // Summarize history if too long
    const optimizedHistory = summarizeConversationHistory(conversationHistory);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...optimizedHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const stream = await retryWithBackoff(async () => {
      return openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.4,
        max_tokens: 1000,
        stream: true,
      });
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    const parsedError = parseOpenAIError(error);
    console.error('Streaming error:', error);

    // If service is unavailable, return fallback response
    if (parsedError.type === 'service_unavailable' || parsedError.type === 'network_error') {
      yield getFallbackResponse(userMessage, inventory);
    } else {
      yield `⚠️ ${parsedError.message}`;
    }
  }
}

// Non-streaming version with improved error handling
export async function getImprovedAssistantResponse(
  userMessage: string,
  inventory: InventoryItem[],
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  stockMovements?: StockMovement[],
  userName?: string
): Promise<{ response: string; usedFallback: boolean }> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      response: "AI assistant is not configured. Please add OPENAI_API_KEY to your environment variables.",
      usedFallback: true,
    };
  }

  try {
    const inventoryContext = formatInventoryContext(inventory);
    const movementContext = stockMovements ? formatStockMovementContext(stockMovements) : '';
    const systemPrompt = buildSystemPrompt(inventoryContext, movementContext, userName);

    // Summarize history if too long
    const optimizedHistory = summarizeConversationHistory(conversationHistory);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...optimizedHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await retryWithBackoff(async () => {
      return openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.4,
        max_tokens: 1000,
      });
    });

    const assistantMessage = response.choices[0]?.message?.content;

    if (!assistantMessage) {
      return {
        response: getFallbackResponse(userMessage, inventory),
        usedFallback: true,
      };
    }

    return {
      response: assistantMessage,
      usedFallback: false,
    };
  } catch (error) {
    const parsedError = parseOpenAIError(error);
    console.error('AI response error:', error);

    // Return fallback response for service issues
    if (parsedError.type === 'service_unavailable' || parsedError.type === 'network_error' || parsedError.retryable) {
      return {
        response: getFallbackResponse(userMessage, inventory),
        usedFallback: true,
      };
    }

    return {
      response: `⚠️ ${parsedError.message}`,
      usedFallback: true,
    };
  }
}
