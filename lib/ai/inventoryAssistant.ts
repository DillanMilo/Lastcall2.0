import OpenAI from 'openai';
import { InventoryItem } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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
 * Get AI-powered inventory insights and recommendations
 */
export async function getInventoryAssistantResponse(
  userMessage: string,
  inventory: InventoryItem[],
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "AI assistant is not configured. Please add OPENAI_API_KEY to your environment variables.";
  }

  try {
    const inventoryContext = formatInventoryContext(inventory);

    const systemPrompt = `You are an expert inventory management assistant for LastCall, a smart inventory system. Your role is to help users understand their stock levels, identify issues, and provide actionable recommendations.

CURRENT INVENTORY DATA:
${inventoryContext}

YOUR CAPABILITIES:
- Analyze stock levels and identify low stock items
- Predict when items will run out based on current levels and expiration dates
- Recommend reorder quantities and timing
- Identify items expiring soon and suggest actions
- Provide insights on inventory turnover
- Alert about potential stockouts
- Suggest optimal reorder points
- Suggest items to remove from inventory if they are not selling
- Suggest items to run a sale on if they are not selling
- Group items by invoice/batch for bulk actions
- Compare stock across categories and invoices
- Offer a daily summary of the inventory and any issues or recommendations
- Offer a weekly summary of the inventory and any issues or recommendations
- Offer a monthly summary of the inventory and any issues or recommendations
- Offer a yearly summary of the inventory and any issues or recommendations

GUIDELINES:
1. Be concise and actionable - prioritize urgent issues
2. Use specific numbers and item names from the inventory
3. Always mention invoice numbers when relevant for batch operations
4. Highlight urgent items with 🚨 and good status with ✅
5. Provide specific recommendations (e.g., "Order 50 more units by Friday")
6. If asked about items not in inventory, clearly state they don't exist
7. Use bullet points for multiple recommendations
8. Calculate days of stock remaining when relevant
9. Always be helpful and friendly and professional
10. Use emojis liberally

EXAMPLE RESPONSES:
- "🚨 URGENT: 3 items need immediate attention..."
- "Based on current stock, you should reorder [item] within 7 days"
- "Items in invoice INV-123 are all expiring within 2 weeks..."

Always base your answers ONLY on the provided inventory data. Never make up stock levels or items.`;

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
  } catch (error: any) {
    console.error('Error getting AI response:', error);
    return `Error: ${error.message || 'Failed to get AI response'}`;
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

