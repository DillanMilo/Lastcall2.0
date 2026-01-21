import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getTierLimits } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * GET /api/usage
 * Returns usage statistics for the authenticated user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.next();

    // Authenticate user
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's org
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgId = userData.org_id;

    // Use service role for accurate counts
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get organization tier and billing exempt status
    const { data: orgData, error: orgError } = await adminClient
      .from('organizations')
      .select('subscription_tier, name, billing_exempt')
      .eq('id', orgId)
      .single();

    if (orgError || !orgData) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const tier = (orgData.subscription_tier || 'free') as PlanTier;
    const billingExempt = orgData.billing_exempt === true;
    const limits = getTierLimits(tier, billingExempt);

    // Get product count
    const { count: productCount } = await adminClient
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    // Get user count
    const { count: userCount } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    // Get AI requests this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: aiRequestCount } = await adminClient
      .from('ai_requests')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startOfMonth);

    // Calculate percentages
    const getPercentage = (used: number, limit: number) => {
      if (limit === -1) return 0; // Unlimited
      return Math.min(Math.round((used / limit) * 100), 100);
    };

    const usage = {
      products: {
        used: productCount || 0,
        limit: limits.products,
        percentage: getPercentage(productCount || 0, limits.products),
        unlimited: limits.products === -1,
      },
      users: {
        used: userCount || 0,
        limit: limits.users,
        percentage: getPercentage(userCount || 0, limits.users),
        unlimited: limits.users === -1,
      },
      aiRequests: {
        used: aiRequestCount || 0,
        limit: limits.aiRequests,
        percentage: getPercentage(aiRequestCount || 0, limits.aiRequests),
        unlimited: limits.aiRequests === -1,
        resetsAt: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      },
    };

    return NextResponse.json({
      success: true,
      organization: {
        id: orgId,
        name: orgData.name,
        tier,
        billingExempt,
      },
      usage,
      limits,
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
