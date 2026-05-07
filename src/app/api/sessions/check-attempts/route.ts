import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/sessions/check-attempts?productSlug=quantum-initiation
 * Checks if user can create new version and returns attempt info
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const productSlug = searchParams.get('productSlug');

    if (!productSlug) {
      return NextResponse.json(
        { error: 'Missing productSlug parameter' },
        { status: 400 }
      );
    }

    // Check attempts
    const { data, error } = await supabase.rpc('can_create_new_version', {
      p_user_id: user.id,
      p_product_slug: productSlug,
    });

    if (error) {
      console.error('Error checking attempts:', error);
      return NextResponse.json(
        { error: 'Failed to check attempts' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in check-attempts:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
