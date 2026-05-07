import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

type Params = { params: Promise<{ slug: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { slug } = await params;

  const { data, error } = await supabaseAdmin
    .from('product_landing_pages')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('product_slug', slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ page: data });
}
