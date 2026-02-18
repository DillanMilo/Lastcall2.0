import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAiLabel } from '@/lib/ai/labelGenerator';
import { checkAIRequestLimit, logAIRequest } from '@/lib/stripe/tier-limits';
import type { PlanTier } from '@/lib/stripe/config';
import { checkRateLimit, RATE_LIMITS } from '@/lib/utils/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { itemName, orgId } = await request.json();

    if (!itemName || typeof itemName !== 'string') {
      return NextResponse.json(
        { error: 'Item name is required' },
        { status: 400 }
      );
    }

    // Rate limit AI label requests
    if (orgId) {
      const rateCheck = checkRateLimit(`ai:${orgId}`, RATE_LIMITS.ai);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: 'Too many AI requests. Please wait a moment.' },
          { status: 429 }
        );
      }
    }

    // If orgId is provided, check tier-based limits
    if (orgId) {
      const supabase = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Get organization tier
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('subscription_tier, billing_exempt')
        .eq('id', orgId)
        .single();

      if (!orgError && orgData) {
        const tier = (orgData.subscription_tier || 'free') as PlanTier;
        const billingExempt = orgData.billing_exempt || false;

        // Check AI request limit
        const limitCheck = await checkAIRequestLimit(supabase, orgId, tier, billingExempt);
        if (!limitCheck.allowed) {
          return NextResponse.json(
            {
              status: 'rate_limited',
              error: 'AI request limit reached',
              message: limitCheck.message,
              currentCount: limitCheck.currentCount,
              limit: limitCheck.limit,
              upgradeRequired: true,
            },
            { status: 403 }
          );
        }

        // Log the AI request
        await logAIRequest(supabase, orgId, 'label');
      }
    }

    const result = await generateAiLabel(itemName);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error in AI label API:', error);
    return NextResponse.json(
      {
        status: 'insufficient_data',
        reason: 'AI service temporarily unavailable. Please try again.',
      },
      { status: 500 }
    );
  }
}

