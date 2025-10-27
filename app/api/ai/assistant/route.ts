import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getInventoryAssistantResponse } from '@/lib/ai/inventoryAssistant';
import { InventoryItem } from '@/types';

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

    // Get AI response with inventory context
    const aiResponse = await getInventoryAssistantResponse(
      message,
      inventory as InventoryItem[],
      conversationHistory || []
    );

    return NextResponse.json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in AI assistant API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

