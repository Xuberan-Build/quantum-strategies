import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { DIRECTIONS, GraphValidationError, inferDirection, linkAssets, parseAssetRef } from '@/lib/content/any-to-any/graph';
import type { Direction } from '@/lib/content/any-to-any/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST { from: AssetRef, to: AssetRef, direction?, insightId?, note? } → { link }. Direction is computed from the forms when omitted. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const raw = await readJson(req);
  if (!raw) return jsonError('Body must be a JSON object', 400);
  try {
    const from = parseAssetRef(raw.from, 'from');
    const to = parseAssetRef(raw.to, 'to');
    if (raw.direction != null && !DIRECTIONS.includes(raw.direction)) return jsonError(`direction must be one of ${DIRECTIONS.join(', ')}`, 400);
    const direction: Direction = raw.direction ?? (await inferDirection(supabaseAdmin, from, to));
    const link = await linkAssets(supabaseAdmin, {
      from, to, direction,
      insightId: raw.insightId === undefined ? undefined : raw.insightId,
      note: raw.note ?? null,
      createdBy: auth.admin.id,
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    if (err instanceof GraphValidationError) return jsonError(err.message, 400);
    return serverError('link assets', err);
  }
}
