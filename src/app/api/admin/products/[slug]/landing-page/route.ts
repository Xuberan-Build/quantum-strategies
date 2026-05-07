import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { slug } = await params;

  const { data, error } = await supabaseAdmin
    .from('product_landing_pages')
    .select('*')
    .eq('product_slug', slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ page: data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { slug } = await params;
  const body = await req.json();

  const allowed = [
    'badge', 'hero_headline', 'hero_accent', 'hero_description',
    'hero_microcopy', 'hero_cta_label', 'features',
    'pricing_headline', 'pricing_bullets', 'pricing_cta',
    'faq', 'seo_title', 'seo_description',
  ];
  const updates: Record<string, unknown> = { product_slug: slug };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from('product_landing_pages')
    .upsert(updates, { onConflict: 'product_slug' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ page: data });
}
