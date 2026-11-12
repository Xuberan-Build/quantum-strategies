import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { createInsight, listInsights, parseInsightInput, type InsightInput } from '@/lib/content/any-to-any/insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/content/insights?q=&pillar=&sourceKind=&status=active|archived|all&postId=&limit= → { insights } */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  try {
    const insights = await listInsights(supabaseAdmin, {
      q: sp.get('q'),
      pillar: sp.get('pillar'),
      sourceKind: sp.get('sourceKind'),
      status: status === 'archived' || status === 'all' ? status : 'active',
      postId: sp.get('postId'),
      limit: Number(sp.get('limit')) || 100,
    });
    return NextResponse.json({ insights });
  } catch (err) {
    return serverError('list insights', err);
  }
}

/** POST /api/admin/content/insights { line, source_kind?, source_ref?, source_post_id?, claim?, ... } → { insight } */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const raw = await readJson(req);
  if (!raw) return jsonError('Body must be a JSON object', 400);
  const { value, errors } = parseInsightInput(raw);
  if (!value) return jsonError(errors.join('; '), 400, { errors });
  try {
    const insight = await createInsight(supabaseAdmin, value as InsightInput, auth.admin.id);
    return NextResponse.json({ insight }, { status: 201 });
  } catch (err) {
    return serverError('create insight', err);
  }
}
