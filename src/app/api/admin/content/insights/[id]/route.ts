import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { archiveInsight, assetsForInsight, getInsight, parseInsightInput, updateInsight } from '@/lib/content/any-to-any/insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET → { insight, assets: { pieces, socialPosts, links, source } } */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const insight = await getInsight(supabaseAdmin, id);
    if (!insight) return jsonError('Insight not found', 404);
    const assets = await assetsForInsight(supabaseAdmin, id);
    return NextResponse.json({ insight, assets });
  } catch (err) {
    return serverError('get insight', err);
  }
}

/** PATCH { any insight field, status? } → { insight } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  const raw = await readJson(req);
  if (!raw) return jsonError('Body must be a JSON object', 400);
  const { value, errors } = parseInsightInput(raw, { partial: true });
  if (!value) return jsonError(errors.join('; '), 400, { errors });
  try {
    const insight = await updateInsight(supabaseAdmin, id, value);
    if (!insight) return jsonError('Insight not found', 404);
    return NextResponse.json({ insight });
  } catch (err) {
    return serverError('update insight', err);
  }
}

/** DELETE = archive (status 'archived'); assets keep their insight_id. → { insight } */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const insight = await archiveInsight(supabaseAdmin, id);
    if (!insight) return jsonError('Insight not found', 404);
    return NextResponse.json({ insight });
  } catch (err) {
    return serverError('archive insight', err);
  }
}
