import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { InventoryItem } from '@/types';

/**
 * GET /api/inventory
 * Fetch all inventory items for an organization
 * Query params: org_id (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inventory:', error);
      return NextResponse.json(
        { error: 'Failed to fetch inventory' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      items: data,
    });
  } catch (error) {
    console.error('Error in GET /api/inventory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory
 * Create new inventory item(s)
 * Body: { org_id, items: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, items } = body;

    if (!org_id) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate and prepare items
    const preparedItems = items.map((item) => {
      if (!item.name) {
        throw new Error('Each item must have a name');
      }

      return {
        org_id,
        name: item.name,
        sku: item.sku || null,
        invoice: item.invoice || null,
        quantity: parseInt(item.quantity || '0', 10),
        reorder_threshold: parseInt(item.reorder_threshold || '0', 10),
        category: item.category || null,
        ai_label: item.ai_label || null,
        expiration_date: item.expiration_date || null,
      };
    });

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(preparedItems)
      .select();

    if (error) {
      console.error('Error inserting inventory:', error);
      return NextResponse.json(
        { error: 'Failed to create inventory items', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      items: data,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/inventory:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

