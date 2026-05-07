import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function GET() {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('workshops')
    .select(`
      id, title, slug, description, status, created_at, updated_at,
      workshop_modules(count)
    `)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workshops: data });
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { title, slug, description } = await request.json();
  if (!title?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: 'title and slug are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('workshops')
    .insert({ title: title.trim(), slug: slug.trim().toLowerCase().replace(/\s+/g, '-'), description })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workshop: data }, { status: 201 });
}

export const dynamic = 'force-dynamic';
