import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/sessions/create-version
 * Creates a new version of a product session
 * Copies placements from parent session, increments version number
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productSlug, parentSessionId } = await request.json();

    if (!productSlug || !parentSessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user can create new version
    const { data: canCreateData, error: checkError } = await supabase.rpc(
      'can_create_new_version',
      {
        p_user_id: user.id,
        p_product_slug: productSlug,
      }
    );

    if (checkError) {
      console.error('Error checking version eligibility:', checkError);
      return NextResponse.json(
        { error: 'Failed to check eligibility' },
        { status: 500 }
      );
    }

    if (!canCreateData.canCreate) {
      return NextResponse.json(
        {
          error: 'Free attempts limit reached',
          attemptsUsed: canCreateData.attemptsUsed,
          attemptsLimit: canCreateData.attemptsLimit,
          requiresPurchase: true,
        },
        { status: 403 }
      );
    }

    // Create new version
    const { data: newSessionId, error: createError } = await supabase.rpc(
      'create_session_version',
      {
        p_user_id: user.id,
        p_product_slug: productSlug,
        p_parent_session_id: parentSessionId,
      }
    );

    if (createError) {
      console.error('Error creating session version:', createError);
      return NextResponse.json(
        { error: 'Failed to create new version' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: newSessionId,
      attemptsRemaining: canCreateData.attemptsRemaining - 1,
    });
  } catch (error: any) {
    console.error('Error in create-version:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
