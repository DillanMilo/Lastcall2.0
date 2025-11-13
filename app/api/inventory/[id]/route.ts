import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Create authenticated Supabase client for API routes
 */
function createAuthenticatedClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )
}

/**
 * Get the authenticated user's organization ID
 */
async function getUserOrgId(request: NextRequest, response: NextResponse): Promise<string | null> {
  try {
    const supabase = createAuthenticatedClient(request, response);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return null;
    }

    return userData.org_id;
  } catch (error) {
    console.error('Error getting user organization:', error);
    return null;
  }
}

/**
 * Check if an item belongs to the user's organization
 */
async function validateItemOwnership(itemId: string, userOrgId: string, supabase: ReturnType<typeof createAuthenticatedClient>): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('org_id')
      .eq('id', itemId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.org_id === userOrgId;
  } catch (error) {
    console.error('Error validating item ownership:', error);
    return false;
  }
}

/**
 * GET /api/inventory/[id]
 * Fetch a single inventory item by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const response = NextResponse.next();
    const { id } = await params;

    // Authenticate user and get their org
    const userOrgId = await getUserOrgId(request, response);
    if (!userOrgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(request, response);

    // Validate item ownership
    const isOwner = await validateItemOwnership(id, userOrgId, supabase);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const response = NextResponse.next();
    const { id } = await params;

    // Authenticate user and get their org
    const userOrgId = await getUserOrgId(request, response);
    if (!userOrgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(request, response);

    // Validate item ownership
    const isOwner = await validateItemOwnership(id, userOrgId, supabase);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

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
  } catch (error: unknown) {
    console.error('Error in PUT /api/inventory/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const response = NextResponse.next();
    const { id } = await params;

    // Authenticate user and get their org
    const userOrgId = await getUserOrgId(request, response);
    if (!userOrgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(request, response);

    // Validate item ownership
    const isOwner = await validateItemOwnership(id, userOrgId, supabase);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

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
  } catch (error: unknown) {
    console.error('Error in PATCH /api/inventory/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const response = NextResponse.next();
    const { id } = await params;

    // Authenticate user and get their org
    const userOrgId = await getUserOrgId(request, response);
    if (!userOrgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(request, response);

    // Validate item ownership
    const isOwner = await validateItemOwnership(id, userOrgId, supabase);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

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
  } catch (error: unknown) {
    console.error('Error in DELETE /api/inventory/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

