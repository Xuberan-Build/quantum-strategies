import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// PATCH /api/admin/content/bulk-assign
// Body: { assignments: [{ id: string, pillar_id: string | null }] }
export async function PATCH(req: NextRequest) {
  const { assignments } = await req.json();
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return NextResponse.json({ error: 'assignments array required' }, { status: 400 });
  }

  const results = await Promise.all(
    assignments.map(({ id, pillar_id }: { id: string; pillar_id: string | null }) =>
      supabaseAdmin
        .from('content_posts')
        .update({ pillar_id: pillar_id ?? null })
        .eq('id', id)
        .select('id, pillar_id')
        .single()
    )
  );

  const errors = results.filter((r) => r.error);
  if (errors.length) {
    return NextResponse.json({ error: errors[0].error?.message }, { status: 500 });
  }

  return NextResponse.json({ updated: results.length });
}
