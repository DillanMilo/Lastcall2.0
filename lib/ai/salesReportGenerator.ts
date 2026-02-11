import { InventoryItem } from '@/types';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface SalesReportData {
  period: ReportPeriod;
  periodLabel: string;
  dateRange: { start: string; end: string };
  daysInPeriod: number;
  totalUnitsSold: number;
  totalUnitsRestocked: number;
  netStockChange: number;
  totalTransactions: number;
  topSellers: { name: string; sku: string | null; unitsSold: number; avgPerDay: number }[];
  slowMovers: { name: string; sku: string | null; unitsSold: number; daysNoMovement: number }[];
  deadStock: { name: string; sku: string | null; currentQty: number }[];
  categoryBreakdown: { category: string; unitsSold: number; itemCount: number }[];
  stockAlerts: { name: string; currentQty: number; daysLeft: number; urgency: 'critical' | 'warning' | 'ok' }[];
  turnoverRate: number;
  avgDailySales: number;
  restockEvents: number;
  expiringItems: { name: string; daysUntilExpiry: number; currentQty: number }[];
}

/**
 * Get the date range for a given report period
 */
export function getDateRange(period: ReportPeriod): { start: Date; end: Date; daysInPeriod: number; label: string } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end, daysInPeriod: 1, label: `Today (${start.toLocaleDateString()})` };
    case 'weekly':
      start.setDate(start.getDate() - 7);
      return { start, end, daysInPeriod: 7, label: `Last 7 Days (${start.toLocaleDateString()} - ${end.toLocaleDateString()})` };
    case 'monthly':
      start.setDate(start.getDate() - 30);
      return { start, end, daysInPeriod: 30, label: `Last 30 Days (${start.toLocaleDateString()} - ${end.toLocaleDateString()})` };
    case 'quarterly':
      start.setDate(start.getDate() - 90);
      return { start, end, daysInPeriod: 90, label: `Last 90 Days (${start.toLocaleDateString()} - ${end.toLocaleDateString()})` };
  }
}

/**
 * Build sales report data from inventory history records
 */
export function buildSalesReport(
  period: ReportPeriod,
  historyRecords: {
    item_id: string;
    item_name: string;
    sku: string | null;
    quantity_change: number;
    change_type: string;
    created_at: string;
  }[],
  inventory: InventoryItem[],
  daysInPeriod: number,
  dateRange: { start: string; end: string },
  periodLabel: string,
): SalesReportData {
  // Build per-item aggregations
  const itemStats = new Map<string, {
    name: string;
    sku: string | null;
    totalSold: number;
    totalRestocked: number;
    transactions: number;
    lastMovement: string;
    category: string;
  }>();

  for (const record of historyRecords) {
    const existing = itemStats.get(record.item_id);
    if (existing) {
      if (record.quantity_change < 0) {
        existing.totalSold += Math.abs(record.quantity_change);
      } else {
        existing.totalRestocked += record.quantity_change;
      }
      existing.transactions++;
      if (record.created_at > existing.lastMovement) {
        existing.lastMovement = record.created_at;
      }
    } else {
      const invItem = inventory.find(i => i.id === record.item_id);
      itemStats.set(record.item_id, {
        name: record.item_name,
        sku: record.sku,
        totalSold: record.quantity_change < 0 ? Math.abs(record.quantity_change) : 0,
        totalRestocked: record.quantity_change > 0 ? record.quantity_change : 0,
        transactions: 1,
        lastMovement: record.created_at,
        category: invItem?.category || invItem?.ai_label || 'Uncategorized',
      });
    }
  }

  // Total aggregations
  let totalUnitsSold = 0;
  let totalUnitsRestocked = 0;
  let totalTransactions = 0;
  let restockEvents = 0;

  for (const stats of itemStats.values()) {
    totalUnitsSold += stats.totalSold;
    totalUnitsRestocked += stats.totalRestocked;
    totalTransactions += stats.transactions;
    if (stats.totalRestocked > 0) restockEvents++;
  }

  // Top sellers - sorted by units sold descending
  const topSellers = Array.from(itemStats.entries())
    .filter(([, s]) => s.totalSold > 0)
    .sort(([, a], [, b]) => b.totalSold - a.totalSold)
    .slice(0, 10)
    .map(([, s]) => ({
      name: s.name,
      sku: s.sku,
      unitsSold: s.totalSold,
      avgPerDay: Math.round((s.totalSold / daysInPeriod) * 10) / 10,
    }));

  // Slow movers - items in inventory that had very low sales
  const slowMovers: SalesReportData['slowMovers'] = [];
  const deadStock: SalesReportData['deadStock'] = [];

  for (const item of inventory) {
    const stats = itemStats.get(item.id);
    const sold = stats?.totalSold || 0;
    const lastMoved = stats?.lastMovement;
    const daysNoMovement = lastMoved
      ? Math.floor((Date.now() - new Date(lastMoved).getTime()) / (1000 * 60 * 60 * 24))
      : daysInPeriod;

    if (sold === 0 && item.quantity > 0) {
      deadStock.push({
        name: item.name,
        sku: item.sku || null,
        currentQty: item.quantity,
      });
    } else if (sold > 0 && sold / daysInPeriod < 0.5) {
      slowMovers.push({
        name: item.name,
        sku: item.sku || null,
        unitsSold: sold,
        daysNoMovement,
      });
    }
  }

  // Category breakdown
  const categoryMap = new Map<string, { unitsSold: number; itemCount: number }>();
  for (const stats of itemStats.values()) {
    const cat = stats.category;
    const existing = categoryMap.get(cat);
    if (existing) {
      existing.unitsSold += stats.totalSold;
      existing.itemCount++;
    } else {
      categoryMap.set(cat, { unitsSold: stats.totalSold, itemCount: 1 });
    }
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.unitsSold - a.unitsSold);

  // Stock alerts - items that are running low based on velocity
  const stockAlerts: SalesReportData['stockAlerts'] = [];
  for (const item of inventory) {
    const stats = itemStats.get(item.id);
    const avgDaily = (stats?.totalSold || 0) / daysInPeriod;
    const daysLeft = avgDaily > 0 ? Math.floor(item.quantity / avgDaily) : 999;

    if (daysLeft <= 7) {
      stockAlerts.push({ name: item.name, currentQty: item.quantity, daysLeft, urgency: 'critical' });
    } else if (daysLeft <= 14) {
      stockAlerts.push({ name: item.name, currentQty: item.quantity, daysLeft, urgency: 'warning' });
    }
  }
  stockAlerts.sort((a, b) => a.daysLeft - b.daysLeft);

  // Expiring items
  const expiringItems: SalesReportData['expiringItems'] = inventory
    .filter(item => {
      if (!item.expiration_date) return false;
      const days = Math.ceil((new Date(item.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 30;
    })
    .map(item => ({
      name: item.name,
      daysUntilExpiry: Math.ceil((new Date(item.expiration_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      currentQty: item.quantity,
    }))
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  // Turnover rate = total sold / average inventory (simplified)
  const totalInventory = inventory.reduce((sum, i) => sum + i.quantity, 0);
  const turnoverRate = totalInventory > 0 ? Math.round((totalUnitsSold / totalInventory) * 100) / 100 : 0;

  return {
    period,
    periodLabel,
    dateRange,
    daysInPeriod,
    totalUnitsSold,
    totalUnitsRestocked,
    netStockChange: totalUnitsRestocked - totalUnitsSold,
    totalTransactions,
    topSellers,
    slowMovers: slowMovers.slice(0, 10),
    deadStock: deadStock.slice(0, 10),
    categoryBreakdown,
    stockAlerts,
    turnoverRate,
    avgDailySales: Math.round((totalUnitsSold / daysInPeriod) * 10) / 10,
    restockEvents,
    expiringItems,
  };
}

/**
 * Format sales report data into a context string for the AI to analyze
 */
export function formatSalesReportContext(report: SalesReportData): string {
  let context = `
SALES REPORT: ${report.periodLabel}
${'='.repeat(50)}

OVERVIEW:
- Period: ${report.dateRange.start} to ${report.dateRange.end}
- Total Units Sold: ${report.totalUnitsSold}
- Total Units Restocked: ${report.totalUnitsRestocked}
- Net Stock Change: ${report.netStockChange > 0 ? '+' : ''}${report.netStockChange}
- Total Transactions: ${report.totalTransactions}
- Avg Daily Sales: ${report.avgDailySales} units/day
- Inventory Turnover Rate: ${report.turnoverRate}x
- Restock Events: ${report.restockEvents}
`;

  if (report.topSellers.length > 0) {
    context += `
TOP SELLERS (${report.period}):
${report.topSellers.map((item, i) =>
  `${i + 1}. ${item.name}${item.sku ? ` (${item.sku})` : ''}: ${item.unitsSold} units sold (${item.avgPerDay}/day)`
).join('\n')}
`;
  }

  if (report.categoryBreakdown.length > 0) {
    context += `
SALES BY CATEGORY:
${report.categoryBreakdown.map(cat =>
  `- ${cat.category}: ${cat.unitsSold} units sold (${cat.itemCount} items)`
).join('\n')}
`;
  }

  if (report.stockAlerts.length > 0) {
    context += `
STOCK ALERTS:
${report.stockAlerts.map(alert =>
  `- ${alert.urgency === 'critical' ? '🚨' : '⚠️'} ${alert.name}: ${alert.currentQty} units left (~${alert.daysLeft} days)`
).join('\n')}
`;
  }

  if (report.slowMovers.length > 0) {
    context += `
SLOW MOVERS:
${report.slowMovers.map(item =>
  `- ${item.name}: only ${item.unitsSold} units in ${report.daysInPeriod} days`
).join('\n')}
`;
  }

  if (report.deadStock.length > 0) {
    context += `
DEAD STOCK (Zero Movement):
${report.deadStock.map(item =>
  `- ${item.name}: ${item.currentQty} units sitting idle`
).join('\n')}
`;
  }

  if (report.expiringItems.length > 0) {
    context += `
EXPIRING SOON:
${report.expiringItems.map(item =>
  `- ${item.name}: expires in ${item.daysUntilExpiry} days (${item.currentQty} units)`
).join('\n')}
`;
  }

  return context;
}

/**
 * Build the system prompt for sales report generation
 */
export function buildReportSystemPrompt(reportContext: string, period: ReportPeriod): string {
  const periodInstructions: Record<ReportPeriod, string> = {
    daily: `This is a DAILY report. Focus on:
- Today's sales activity vs typical daily averages
- Any unusual spikes or drops in specific items
- Items that need immediate restocking
- Urgent expiration warnings
Keep it brief and actionable - this is a quick daily check-in.`,
    weekly: `This is a WEEKLY report. Focus on:
- Week-over-week trends and patterns
- Top performers and underperformers for the week
- Ordering recommendations for the coming week
- Items approaching reorder points
- Weekly velocity changes`,
    monthly: `This is a MONTHLY report. Focus on:
- Monthly sales performance and trends
- Category-level analysis and insights
- Inventory turnover assessment
- Dead stock identification and recommendations
- Strategic ordering suggestions for next month
- Cash flow considerations (over-stocked vs under-stocked)`,
    quarterly: `This is a QUARTERLY report. Focus on:
- Quarterly business performance overview
- Seasonal patterns and trend analysis
- ABC analysis (identify your A, B, and C items)
- Strategic inventory recommendations
- Dead stock that should be discontinued
- Category performance comparison
- Long-term ordering strategy suggestions`,
  };

  return `You are a senior inventory analytics expert generating a ${period} sales report for a business using LastCallIQ. Your job is to turn raw data into actionable business insights.

${reportContext}

REPORT INSTRUCTIONS:
${periodInstructions[period]}

FORMAT YOUR REPORT WITH:
1. **Executive Summary** - 2-3 sentence overview of the period
2. **Key Metrics** - Important numbers at a glance
3. **Top Performers** - Best selling items with context
4. **Concerns & Alerts** - Stock issues, dead stock, expiring items
5. **Recommendations** - Specific, actionable next steps

RULES:
- Use specific numbers from the data - never invent or estimate
- Use emoji indicators: 📈 growth, 📉 decline, 🚨 critical, ⚠️ warning, ✅ healthy, 💡 insight, 📊 data
- Be concise but thorough - business owners are busy
- Lead with the most important insights
- If data is limited (few transactions), acknowledge it and provide what insights you can
- Compare to implied averages where possible (e.g., "selling 5/day vs your 3/day average")
- Always end with clear action items`;
}
