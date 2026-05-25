import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's profile placements
    const { data, error } = await supabase
      .from('users')
      .select('placements, placements_confirmed, placements_updated_at')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile placements:', error);
      return NextResponse.json({ error: 'Failed to fetch profile data' }, { status: 500 });
    }

    return NextResponse.json({
      placements: data?.placements || null,
      placements_confirmed: data?.placements_confirmed || false,
      placements_updated_at: data?.placements_updated_at || null,
    });
  } catch (error: any) {
    console.error('Profile placements GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { placements, confirmed } = body;

    if (!placements) {
      return NextResponse.json({ error: 'Placements data required' }, { status: 400 });
    }

    // Update user's profile placements
    const { data, error } = await supabase
      .from('users')
      .update({
        placements,
        placements_confirmed: confirmed ?? true,
        placements_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('placements, placements_confirmed, placements_updated_at')
      .single();

    if (error) {
      console.error('Error updating profile placements:', error);
      return NextResponse.json({ error: 'Failed to update profile data' }, { status: 500 });
    }

    // Cascade to active product sessions that have no confirmed placements yet
    // so the next product the user opens inherits the updated data automatically.
    await supabase
      .from('product_sessions')
      .update({ placements, placements_confirmed: true })
      .eq('user_id', user.id)
      .eq('placements_confirmed', false)
      .is('placements', null);

    return NextResponse.json({
      success: true,
      placements: data.placements,
      placements_confirmed: data.placements_confirmed,
      placements_updated_at: data.placements_updated_at,
    });
  } catch (error: any) {
    console.error('Profile placements POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear user's profile placements
    const { error } = await supabase
      .from('users')
      .update({
        placements: null,
        placements_confirmed: false,
        placements_updated_at: null,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error clearing profile placements:', error);
      return NextResponse.json({ error: 'Failed to clear profile data' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Profile placements DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
