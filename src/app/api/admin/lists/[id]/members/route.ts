import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('list_members')
      .select('id, added_at, added_by, users(id, name, email, created_at)')
      .eq('list_id', id)
      .order('added_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: list_id } = await params;
    const body = await request.json();
    const { added_by } = body;
    let { user_id, email } = body;

    if (!user_id && !email) {
      return NextResponse.json({ error: 'user_id or email is required' }, { status: 400 });
    }

    if (!user_id && email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      user_id = user.id;
    }

    const { data, error } = await supabaseAdmin
      .from('list_members')
      .insert({ list_id, user_id, added_by })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already a member' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
