import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/inventory/[id]
 * Fetch a single inventory item by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
    });
  } catch (error) {
    console.error('Error in GET /api/inventory/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/[id]
 * Update an inventory item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const updates = await request.json();

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.org_id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating inventory:', error);
      return NextResponse.json(
        { error: 'Failed to update item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/inventory/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inventory/[id]
 * Partially update an inventory item (e.g., just quantity)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const updates = await request.json();

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.org_id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error patching inventory:', error);
      return NextResponse.json(
        { error: 'Failed to update item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/inventory/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/[id]
 * Delete an inventory item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting inventory:', error);
      return NextResponse.json(
        { error: 'Failed to delete item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/inventory/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

