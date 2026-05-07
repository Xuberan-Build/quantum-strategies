import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/sessions/get-versions?productSlug=quantum-initiation
 * Returns all session versions for a product
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

    // Get version history
    const { data: versions, error } = await supabase.rpc(
      'get_session_versions',
      {
        p_user_id: user.id,
        p_product_slug: productSlug,
      }
    );

    if (error) {
      console.error('Error fetching versions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch versions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      versions: versions || [],
    });
  } catch (error: any) {
    console.error('Error in get-versions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
