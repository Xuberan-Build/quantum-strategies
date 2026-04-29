import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: user_id } = await params;

    // Fetch the user to determine smart list eligibility
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, discord_id')
      .eq('id', user_id)
      .single();

    if (userError) throw userError;

    // Fetch static list memberships
    const { data: memberships, error: memberError } = await supabaseAdmin
      .from('list_members')
      .select('list_id, contact_lists(id, name, list_type, filter_criteria)')
      .eq('user_id', user_id);

    if (memberError) throw memberError;

    const staticLists = (memberships || []).map((m: any) => ({
      ...m.contact_lists,
      membership: 'static',
    }));

    // Determine smart list membership
    const { data: smartLists, error: smartError } = await supabaseAdmin
      .from('contact_lists')
      .select('id, name, list_type, filter_criteria')
      .eq('list_type', 'smart');

    if (smartError) throw smartError;

    const qualifiedSmartLists = (smartLists || [])
      .filter((list: any) => {
        const source = list.filter_criteria?.source;
        if (source === 'all_users') return !!user.email;
        if (source === 'discord_linked') return !!user.discord_id && !!user.email;
        return false;
      })
      .map((list: any) => ({ ...list, membership: 'smart' }));

    return NextResponse.json({ lists: [...qualifiedSmartLists, ...staticLists] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: user_id } = await params;
    const { list_id } = await request.json();

    if (!list_id) {
      return NextResponse.json({ error: 'list_id required' }, { status: 400 });
    }

    // Verify the list exists and is static
    const { data: list, error: listError } = await supabaseAdmin
      .from('contact_lists')
      .select('id, list_type')
      .eq('id', list_id)
      .single();

    if (listError) throw listError;
    if (list.list_type !== 'static') {
      return NextResponse.json({ error: 'Cannot manually add members to a smart list' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('list_members')
      .insert({ list_id, user_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'User already in list' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ member: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
