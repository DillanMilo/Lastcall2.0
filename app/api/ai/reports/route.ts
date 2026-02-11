import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { InventoryItem } from '@/types';
import { checkAIRequestLimit, logAIRequest } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';
import {
  ReportPeriod,
  getDateRange,
  buildSalesReport,
  formatSalesReportContext,
  buildReportSystemPrompt,
} from '@/lib/ai/salesReportGenerator';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { orgId, period } = await request.json();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const validPeriods: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly'];
    if (!period || !validPeriods.includes(period)) {
      return NextResponse.json(
        { error: 'Valid period is required (daily, weekly, monthly, quarterly)' },
        { status: 400 }
      );
    }

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

    // Get date range for the requested period
    const { start, end, daysInPeriod, label: periodLabel } = getDateRange(period as ReportPeriod);

    // Fetch inventory history for the period
    const { data: history, error: historyError } = await supabase
      .from('inventory_history')
      .select('item_id, item_name, sku, quantity_change, change_type, created_at')
      .eq('org_id', orgId)
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

    // Build the report data
    const reportData = buildSalesReport(
      period as ReportPeriod,
      history || [],
      (inventory || []) as InventoryItem[],
      daysInPeriod,
      { start: start.toLocaleDateString(), end: end.toLocaleDateString() },
      periodLabel,
    );

    // If no data at all, return a helpful message without using AI tokens
    if (!history || history.length === 0) {
      const noDataReport = generateNoDataReport(period as ReportPeriod, periodLabel, (inventory || []) as InventoryItem[]);
      return NextResponse.json({
        success: true,
        report: noDataReport,
        reportData,
        period,
        periodLabel,
        timestamp: new Date().toISOString(),
        hasData: false,
      });
    }

    // Format report context for AI
    const reportContext = formatSalesReportContext(reportData);
    const systemPrompt = buildReportSystemPrompt(reportContext, period as ReportPeriod);

    // Log the AI request
    await logAIRequest(supabase, orgId, 'report');

    // Generate AI report
    if (!process.env.OPENAI_API_KEY) {
      // Return raw data report without AI analysis
      return NextResponse.json({
        success: true,
        report: generateFallbackReport(reportData),
        reportData,
        period,
        periodLabel,
        timestamp: new Date().toISOString(),
        hasData: true,
        usedFallback: true,
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a ${period} sales report based on the data provided. Make it insightful and actionable.` },
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
        period,
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
      period,
      periodLabel,
      timestamp: new Date().toISOString(),
      hasData: true,
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

/**
 * Generate a report when there's no history data
 */
function generateNoDataReport(period: ReportPeriod, periodLabel: string, inventory: InventoryItem[]): string {
  const lowStock = inventory.filter(i => i.quantity <= i.reorder_threshold);
  const totalItems = inventory.length;

  return `📊 **${period.charAt(0).toUpperCase() + period.slice(1)} Sales Report - ${periodLabel}**

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
  let report = `📊 **${data.period.charAt(0).toUpperCase() + data.period.slice(1)} Sales Report - ${data.periodLabel}**

**Key Metrics:**
- Units Sold: ${data.totalUnitsSold}
- Units Restocked: ${data.totalUnitsRestocked}
- Net Change: ${data.netStockChange > 0 ? '+' : ''}${data.netStockChange}
- Avg Daily Sales: ${data.avgDailySales} units/day
- Turnover Rate: ${data.turnoverRate}x
`;

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
