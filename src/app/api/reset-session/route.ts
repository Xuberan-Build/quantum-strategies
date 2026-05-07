import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productSlug } = await req.json();

    if (!productSlug) {
      return NextResponse.json({ error: 'productSlug is required' }, { status: 400 });
    }

    // Reset the session back to step 1
    const { data, error } = await supabase
      .from('product_sessions')
      .update({
        is_complete: false,
        completed_at: null,
        deliverable_content: null,
        deliverable_generated_at: null,
        current_step: 1,
        current_section: 1,
        placements_confirmed: false,
        // Keep placements data so you don't have to re-upload
      })
      .eq('user_id', user.id)
      .eq('product_slug', productSlug)
      .select()
      .single();

    if (error) {
      console.error('Reset session error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Session reset successfully. You can now go through the experience again.',
      session: data
    });
  } catch (err: any) {
    console.error('Reset session error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to reset session' }, { status: 500 });
  }
}
