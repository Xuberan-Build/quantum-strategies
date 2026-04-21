import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function GET() {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { data, error: dbError } = await supabaseAdmin
    .from('prompts')
    .select('id, product_slug, scope, step_number, content, version, is_active, updated_at')
    .order('product_slug')
    .order('scope')
    .order('version', { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ prompts: data });
}

export async function POST(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json();
  const { product_slug, scope, step_number, content } = body;

  if (!product_slug || !scope || !content?.trim()) {
    return NextResponse.json({ error: 'product_slug, scope, and content are required' }, { status: 400 });
  }

  // Get the current max version for this prompt
  const { data: existing } = await supabaseAdmin
    .from('prompts')
    .select('version')
    .eq('product_slug', product_slug)
    .eq('scope', scope)
    .eq('step_number', step_number ?? null)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;

  // Deactivate old versions
  await supabaseAdmin
    .from('prompts')
    .update({ is_active: false })
    .eq('product_slug', product_slug)
    .eq('scope', scope)
    .eq('step_number', step_number ?? null);

  // Insert new version
  const { data: newPrompt, error: insertError } = await supabaseAdmin
    .from('prompts')
    .insert({
      product_slug,
      scope,
      step_number: step_number ?? null,
      content: content.trim(),
      version: nextVersion,
      is_active: true,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ prompt: newPrompt });
}
