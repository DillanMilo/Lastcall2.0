import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { InventoryItem } from '@/types';
import { checkAIRequestLimit, logAIRequest } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';
import {
  ReportPeriod,
  OrderDataSummary,
  getDateRange,
  buildSalesReport,
  formatSalesReportContext,
  buildReportSystemPrompt,
} from '@/lib/ai/salesReportGenerator';
import { fetchCloverOrders, CloverOrderSummary } from '@/lib/integrations/clover';
import { fetchBigCommerceOrders, BigCommerceOrderSummary } from '@/lib/integrations/bigcommerce';
import { decryptToken } from '@/lib/utils/encryption';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, period, startDate, endDate } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Validate period - support custom with startDate/endDate
    const validPeriods: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'custom'];
    const reportPeriod: ReportPeriod = (period === 'custom' || (startDate && endDate)) ? 'custom' : period;

    if (!reportPeriod || !validPeriods.includes(reportPeriod)) {
      return NextResponse.json(
        { error: 'Valid period is required (daily, weekly, monthly, quarterly, or custom with startDate/endDate)' },
        { status: 400 }
      );
    }

    if (reportPeriod === 'custom' && (!startDate || !endDate)) {
      return NextResponse.json(
        { error: 'startDate and endDate are required for custom period' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get organization data including integration credentials
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier, billing_exempt, timezone, bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token')
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

    // Get date range for the requested period, using the org's timezone if set
    const orgTimezone = orgData.timezone || undefined;
    const { start, end, daysInPeriod, label: periodLabel } = getDateRange(
      reportPeriod,
      orgTimezone,
      startDate,
      endDate,
    );

    // Fetch inventory history for the period.
    const SALES_CHANGE_TYPES = ['sync', 'webhook', 'sale', 'restock'];

    const { data: history, error: historyError } = await supabase
      .from('inventory_history')
      .select('item_id, item_name, sku, quantity_change, change_type, created_at')
      .eq('org_id', orgId)
      .in('change_type', SALES_CHANGE_TYPES)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true });

    if (historyError) {
      console.error('Error fetching inventory history:', historyError);
      return NextResponse.json(
        { error: 'Failed to fetch sales history data.' },
        { status: 500 }
      );
    }

    // Fetch current inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('org_id', orgId);

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return NextResponse.json(
        { error: 'Failed to fetch inventory data.' },
        { status: 500 }
      );
    }

    // Fetch real order data from connected POS integrations (read-only)
    let orderData: OrderDataSummary | undefined;
    try {
      orderData = await fetchOrderDataFromIntegrations(orgId, orgData, start, end);
    } catch (err) {
      console.warn('Failed to fetch order data from integrations (non-fatal):', err);
    }

    // Build the report data
    const reportData = buildSalesReport(
      reportPeriod,
      history || [],
      (inventory || []) as InventoryItem[],
      daysInPeriod,
      { start: start.toLocaleDateString(), end: end.toLocaleDateString() },
      periodLabel,
    );

    // Attach order data if available
    if (orderData) {
      reportData.orderData = orderData;
    }

    // If no data at all (no history and no order data), return a helpful message
    const hasAnyData = (history && history.length > 0) || (orderData && orderData.totalOrders > 0);

    if (!hasAnyData) {
      const noDataReport = generateNoDataReport(reportPeriod, periodLabel, (inventory || []) as InventoryItem[]);
      return NextResponse.json({
        success: true,
        report: noDataReport,
        reportData,
        period: reportPeriod,
        periodLabel,
        timestamp: new Date().toISOString(),
        hasData: false,
      });
    }

    // Format report context for AI
    const reportContext = formatSalesReportContext(reportData);
    const systemPrompt = buildReportSystemPrompt(reportContext, reportPeriod);

    // Log the AI request
    await logAIRequest(supabase, orgId, 'report');

    // Generate AI report
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        report: generateFallbackReport(reportData),
        reportData,
        period: reportPeriod,
        periodLabel,
        timestamp: new Date().toISOString(),
        hasData: true,
        usedFallback: true,
      });
    }

    const userPrompt = reportPeriod === 'custom'
      ? `Generate a sales report for the period ${periodLabel} based on the data provided. Make it insightful and actionable.`
      : `Generate a ${reportPeriod} sales report based on the data provided. Make it insightful and actionable.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const aiReport = response.choices[0]?.message?.content;

    if (!aiReport) {
      return NextResponse.json({
        success: true,
        report: generateFallbackReport(reportData),
        reportData,
        period: reportPeriod,
        periodLabel,
        timestamp: new Date().toISOString(),
        hasData: true,
        usedFallback: true,
      });
    }

    return NextResponse.json({
      success: true,
      report: aiReport,
      reportData,
      period: reportPeriod,
      periodLabel,
      timestamp: new Date().toISOString(),
      hasData: true,
      hasOrderData: !!orderData,
    });
  } catch (error: unknown) {
    console.error('Error generating sales report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        error: 'Failed to generate report',
        message: errorMessage,
        suggestion: 'Please try again. If the problem persists, try refreshing the page.',
      },
      { status: 500 }
    );
  }
}

interface CloverConnectionRow {
  merchant_id: string;
  access_token: string;
  environment: string;
}

/**
 * Fetch real order/sales data from connected POS integrations.
 * Tries Clover and BigCommerce, combines results if both are connected.
 * This is entirely read-only - no modifications to external systems.
 */
async function fetchOrderDataFromIntegrations(
  orgId: string,
  orgData: {
    bigcommerce_store_hash?: string;
    bigcommerce_client_id?: string;
    bigcommerce_access_token?: string;
  },
  start: Date,
  end: Date,
): Promise<OrderDataSummary | undefined> {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let cloverSummary: CloverOrderSummary | undefined;
  let bigcommerceSummary: BigCommerceOrderSummary | undefined;

  // Try Clover
  try {
    const { data: connections } = await adminClient
      .from('clover_connections')
      .select('merchant_id, access_token, environment')
      .eq('org_id', orgId);

    if (connections && connections.length > 0) {
      let totalRevenue = 0;
      let totalOrders = 0;
      const itemMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();

      for (const conn of connections as unknown as CloverConnectionRow[]) {
        try {
          const result = await fetchCloverOrders(
            {
              merchantId: conn.merchant_id,
              accessToken: decryptToken(conn.access_token),
              environment: conn.environment as 'us' | 'eu',
            },
            start,
            end,
          );
          totalRevenue += result.totalRevenue;
          totalOrders += result.totalOrders;

          for (const item of result.itemBreakdown) {
            const key = item.cloverItemId || item.name;
            const existing = itemMap.get(key);
            if (existing) {
              existing.unitsSold += item.unitsSold;
              existing.revenue += item.revenue;
            } else {
              itemMap.set(key, { name: item.name, unitsSold: item.unitsSold, revenue: item.revenue });
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch Clover orders for merchant ${conn.merchant_id}:`, err);
        }
      }

      if (totalOrders > 0) {
        cloverSummary = {
          totalRevenue,
          totalOrders,
          avgOrderValue: Math.round((totalRevenue / totalOrders) * 100) / 100,
          itemBreakdown: Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue),
        };
      }
    }
  } catch (err) {
    console.warn('Failed to check Clover connections:', err);
  }

  // Try BigCommerce
  try {
    if (orgData.bigcommerce_store_hash && orgData.bigcommerce_client_id && orgData.bigcommerce_access_token) {
      const result = await fetchBigCommerceOrders(
        {
          storeHash: orgData.bigcommerce_store_hash,
          clientId: orgData.bigcommerce_client_id,
          accessToken: decryptToken(orgData.bigcommerce_access_token),
        },
        start,
        end,
      );

      if (result.totalOrders > 0) {
        bigcommerceSummary = result;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch BigCommerce orders:', err);
  }

  // Combine results
  if (cloverSummary && bigcommerceSummary) {
    const combinedItems = new Map<string, { name: string; unitsSold: number; revenue: number }>();

    for (const item of cloverSummary.itemBreakdown) {
      combinedItems.set(item.name, { ...item });
    }
    for (const item of bigcommerceSummary.itemBreakdown) {
      const existing = combinedItems.get(item.name);
      if (existing) {
        existing.unitsSold += item.unitsSold;
        existing.revenue += item.revenue;
      } else {
        combinedItems.set(item.name, { name: item.name, unitsSold: item.unitsSold, revenue: item.revenue });
      }
    }

    const totalRevenue = cloverSummary.totalRevenue + bigcommerceSummary.totalRevenue;
    const totalOrders = cloverSummary.totalOrders + bigcommerceSummary.totalOrders;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
      itemBreakdown: Array.from(combinedItems.values()).sort((a, b) => b.revenue - a.revenue),
      source: 'combined',
    };
  }

  if (cloverSummary) {
    return {
      totalRevenue: cloverSummary.totalRevenue,
      totalOrders: cloverSummary.totalOrders,
      avgOrderValue: cloverSummary.avgOrderValue,
      itemBreakdown: cloverSummary.itemBreakdown,
      source: 'clover',
    };
  }

  if (bigcommerceSummary) {
    return {
      totalRevenue: bigcommerceSummary.totalRevenue,
      totalOrders: bigcommerceSummary.totalOrders,
      avgOrderValue: bigcommerceSummary.avgOrderValue,
      itemBreakdown: bigcommerceSummary.itemBreakdown.map(i => ({
        name: i.name,
        unitsSold: i.unitsSold,
        revenue: i.revenue,
      })),
      source: 'bigcommerce',
    };
  }

  return undefined;
}

/**
 * Generate a report when there's no history data
 */
function generateNoDataReport(period: ReportPeriod, periodLabel: string, inventory: InventoryItem[]): string {
  const lowStock = inventory.filter(i => i.quantity <= i.reorder_threshold);
  const totalItems = inventory.length;
  const periodName = period === 'custom' ? 'Custom Range' : period.charAt(0).toUpperCase() + period.slice(1);

  return `📊 **${periodName} Sales Report - ${periodLabel}**

⚠️ **No stock movement data available for this period.**

This means either:
- No sales, restocks, or inventory changes were recorded
- Inventory tracking was recently set up
- External integrations (Shopify, BigCommerce, Clover) haven't synced yet

**Current Inventory Snapshot:**
- Total Items: ${totalItems}
- Low Stock Items: ${lowStock.length}
${lowStock.length > 0 ? `\n🚨 **Items Needing Attention:**\n${lowStock.slice(0, 5).map(i => `- ${i.name}: ${i.quantity} units (reorder at ${i.reorder_threshold})`).join('\n')}` : ''}

💡 **To get meaningful reports:**
1. Connect your POS/e-commerce platform (Shopify, BigCommerce, or Clover) for automatic tracking
2. Use the inventory sync features to capture stock changes
3. Reports will become more insightful as movement data builds up`;
}

/**
 * Generate a fallback report from raw data (when AI is unavailable)
 */
function generateFallbackReport(data: import('@/lib/ai/salesReportGenerator').SalesReportData): string {
  const periodName = data.period === 'custom' ? 'Custom Range' : data.period.charAt(0).toUpperCase() + data.period.slice(1);

  let report = `📊 **${periodName} Sales Report - ${data.periodLabel}**

**Key Metrics:**
- Units Sold: ${data.totalUnitsSold}
- Units Restocked: ${data.totalUnitsRestocked}
- Net Change: ${data.netStockChange > 0 ? '+' : ''}${data.netStockChange}
- Avg Daily Sales: ${data.avgDailySales} units/day
- Turnover Rate: ${data.turnoverRate}x
`;

  if (data.orderData) {
    report += `
**POS Sales Data (from ${data.orderData.source}):**
- Total Orders: ${data.orderData.totalOrders}
`;
  }

  if (data.topSellers.length > 0) {
    report += `\n**Top Sellers:**\n${data.topSellers.slice(0, 5).map((item, i) =>
      `${i + 1}. ${item.name}: ${item.unitsSold} units (${item.avgPerDay}/day)`
    ).join('\n')}\n`;
  }

  if (data.stockAlerts.length > 0) {
    report += `\n**Stock Alerts:**\n${data.stockAlerts.slice(0, 5).map(alert =>
      `${alert.urgency === 'critical' ? '🚨' : '⚠️'} ${alert.name}: ${alert.currentQty} units (~${alert.daysLeft} days left)`
    ).join('\n')}\n`;
  }

  if (data.deadStock.length > 0) {
    report += `\n**Dead Stock (No Movement):**\n${data.deadStock.slice(0, 5).map(item =>
      `- ${item.name}: ${item.currentQty} units sitting idle`
    ).join('\n')}\n`;
  }

  report += `\n*Note: AI analysis is temporarily unavailable. This is a data-only report.*`;

  return report;
}
