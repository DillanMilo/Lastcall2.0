import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchBigCommerceCatalogItemsWithCredentials } from '@/lib/integrations/bigcommerce';
import { syncInventoryItems } from '@/lib/inventory/syncInventoryItems';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface OnboardingRequest {
  // Organization details
  organization_name: string;
  user_email?: string;
  user_full_name?: string;
  
  // BigCommerce credentials
  bigcommerce_store_hash: string;
  bigcommerce_client_id: string;
  bigcommerce_access_token: string;
  
  // Optional: Initial sync settings
  enable_ai_labeling?: boolean;
  perform_initial_sync?: boolean;
}

/**
 * POST /api/onboarding/bigcommerce
 * 
 * Easy onboarding endpoint for BigCommerce clients.
 * Creates organization, optionally creates user, tests connection, and performs initial sync.
 * 
 * Request Body:
 * {
 *   "organization_name": "Client Company Name",
 *   "user_email": "admin@client.com", // Optional
 *   "user_full_name": "Admin Name", // Optional
 *   "bigcommerce_store_hash": "abc123",
 *   "bigcommerce_client_id": "client_id_here",
 *   "bigcommerce_access_token": "access_token_here",
 *   "enable_ai_labeling": false, // Optional
 *   "perform_initial_sync": true // Optional, defaults to true
 * }
 */
export async function POST(request: NextRequest) {
  try {
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
        { status: 500 }
      );
    }

    const body: OnboardingRequest = await request.json();

    // Validate required fields
    if (!body.organization_name) {
      return NextResponse.json(
        { error: 'organization_name is required' },
        { status: 400 }
      );
    }

    if (!body.bigcommerce_store_hash || !body.bigcommerce_client_id || !body.bigcommerce_access_token) {
      return NextResponse.json(
        { error: 'BigCommerce credentials are required: bigcommerce_store_hash, bigcommerce_client_id, bigcommerce_access_token' },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Step 1: Test BigCommerce connection
    console.log('Testing BigCommerce connection...');
    let connectionTest: { success: boolean; error?: string; store_info?: { name?: string; domain?: string; [key: string]: unknown } } = { success: false };
    
    try {
      const testUrl = `https://api.bigcommerce.com/stores/${body.bigcommerce_store_hash}/v3/store`;
      const testResponse = await fetch(testUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': body.bigcommerce_access_token,
          'X-Auth-Client': body.bigcommerce_client_id,
        },
      });

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        connectionTest = {
          success: false,
          error: `BigCommerce API error (${testResponse.status}): ${errorText || testResponse.statusText}`,
        };
      } else {
        const storeInfo = await testResponse.json();
        connectionTest = {
          success: true,
          store_info: storeInfo.data,
        };
      }
    } catch (error) {
      connectionTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to BigCommerce API',
      };
    }

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'BigCommerce connection test failed',
          details: connectionTest.error,
          step: 'connection_test',
        },
        { status: 400 }
      );
    }

    // Step 2: Create organization
    console.log('Creating organization...');
    const { data: newOrg, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: body.organization_name,
        subscription_tier: 'growth',
      })
      .select('*')
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create organization',
          details: orgError.message,
          step: 'create_organization',
        },
        { status: 500 }
      );
    }

    // Step 3: Optionally create user account
    let userId: string | null = null;
    if (body.user_email) {
      console.log('Creating user account...');
      try {
        // Try to create new auth user (will fail if email already exists)
        const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
          email: body.user_email,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            full_name: body.user_full_name || null,
          },
        });

        if (newAuthUser?.user) {
          // New user created successfully
          userId = newAuthUser.user.id;
          const { error: userError } = await adminClient
            .from('users')
            .insert({
              id: userId,
              email: body.user_email,
              full_name: body.user_full_name || null,
              org_id: newOrg.id,
            });

          if (userError) {
            console.warn('Warning: Could not create user record:', userError);
          }
        } else if (authError && (authError.message?.includes('already registered') || authError.message?.includes('already exists'))) {
          // User already exists - try to find and link them
          console.log('User already exists, attempting to link to organization...');
          // List users to find by email (Supabase doesn't have getUserByEmail)
          const { data: usersList } = await adminClient.auth.admin.listUsers();
          const existingUser = usersList?.users.find(u => u.email === body.user_email);
          
          if (existingUser) {
            userId = existingUser.id;
            // Update user record to link to new org
            const { error: updateError } = await adminClient
              .from('users')
              .upsert({
                id: userId,
                email: body.user_email,
                full_name: body.user_full_name || null,
                org_id: newOrg.id,
              }, { onConflict: 'id' });

            if (updateError) {
              console.warn('Warning: Could not update user record:', updateError);
            }
          } else {
            console.warn('Warning: User email exists but could not find user record');
          }
        } else if (authError) {
          console.warn('Warning: Could not create auth user:', authError);
        }
      } catch (userError) {
        console.warn('Warning: Could not create user account:', userError);
        // Continue with onboarding even if user creation fails
      }
    }

    // Step 4: Perform initial sync (if requested)
    let syncResult: {
      success: boolean;
      results?: { created: number; updated: number; failed: number; errors: string[] };
      summary?: string;
      items_synced?: number;
      message?: string;
      error?: string;
    } | null = null;
    const shouldSync = body.perform_initial_sync !== false; // Default to true

    if (shouldSync) {
      console.log('Performing initial BigCommerce sync...');
      try {
        const items = await fetchBigCommerceCatalogItemsWithCredentials({
          storeHash: body.bigcommerce_store_hash,
          clientId: body.bigcommerce_client_id,
          accessToken: body.bigcommerce_access_token,
        });

        if (items.length > 0) {
          const { success, results, summary } = await syncInventoryItems({
            orgId: newOrg.id,
            source: 'bigcommerce',
            items,
            enableAiLabeling: body.enable_ai_labeling || false,
          });

          syncResult = {
            success,
            results,
            summary,
            items_synced: items.length,
          };
        } else {
          syncResult = {
            success: true,
            message: 'No products found in BigCommerce store',
            items_synced: 0,
          };
        }
      } catch (syncError) {
        console.error('Error during initial sync:', syncError);
        syncResult = {
          success: false,
          error: syncError instanceof Error ? syncError.message : 'Unknown sync error',
        };
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      organization: {
        id: newOrg.id,
        name: newOrg.name,
        subscription_tier: newOrg.subscription_tier,
      },
      user: userId ? {
        id: userId,
        email: body.user_email,
      } : null,
      connection_test: {
        success: connectionTest.success,
        store_name: connectionTest.store_info?.name,
        store_domain: connectionTest.store_info?.domain,
      },
      initial_sync: syncResult,
      next_steps: [
        'Set up webhook in BigCommerce (see documentation)',
        'Configure webhook secret in environment variables',
        'User can now sign in and access dashboard',
      ],
    });
  } catch (error: unknown) {
    console.error('Error in BigCommerce onboarding:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: 'Onboarding failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

