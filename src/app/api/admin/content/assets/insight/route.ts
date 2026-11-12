import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { GraphValidationError, isUuid, parseAssetRef } from '@/lib/content/any-to-any/graph';
import { getInsight, setAssetInsight } from '@/lib/content/any-to-any/insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH { asset: { kind: 'piece' | 'social_post', id }, insightId: uuid | null } → { ok: true, insightId } */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const raw = await readJson(req);
  if (!raw) return jsonError('Body must be a JSON object', 400);
  try {
    const asset = parseAssetRef(raw.asset);
    if (asset.kind !== 'piece' && asset.kind !== 'social_post') return jsonError('asset.kind must be piece or social_post', 400);
    const insightId = raw.insightId ?? null;
    if (insightId !== null) {
      if (!isUuid(insightId)) return jsonError('insightId must be a uuid or null', 400);
      if (!(await getInsight(supabaseAdmin, insightId))) return jsonError('Insight not found', 404);
    }
    const ok = await setAssetInsight(supabaseAdmin, asset, insightId);
    if (!ok) return jsonError('Asset not found', 404);
    return NextResponse.json({ ok: true, insightId });
  } catch (err) {
    if (err instanceof GraphValidationError) return jsonError(err.message, 400);
    return serverError('set asset insight', err);
  }
}
