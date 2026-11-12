import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { listPromotions, proposeFromTarget, proposePromotion, syncDonePromotions } from '@/lib/content/any-to-any/winners';
import { FORM_RANK, type PieceType, type Promotion, type PromotionStatus } from '@/lib/content/any-to-any/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: PromotionStatus[] = ['proposed', 'accepted', 'dismissed', 'done'];
const SOURCE_KINDS: Promotion['source_kind'][] = ['social_target', 'social_post', 'piece', 'external', 'insight'];

const isFormat = (v: unknown): v is PieceType => typeof v === 'string' && v !== 'article' && v in FORM_RANK;
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** GET /api/admin/content/promotions?status=proposed → { promotions } (accepted ones whose piece is published move to done first) */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const raw = req.nextUrl.searchParams.get('status');
  const status = STATUSES.includes(raw as PromotionStatus) ? (raw as PromotionStatus) : null;
  try {
    await syncDonePromotions(supabaseAdmin).catch((e) => console.warn('[promotions] sync done failed:', e instanceof Error ? e.message : e));
    return NextResponse.json({ promotions: await listPromotions(supabaseAdmin, { status }) });
  } catch (err) {
    return serverError('list promotions', err);
  }
}

/**
 * POST /api/admin/content/promotions → { promotion, created }
 * Body: { target_id, proposed_format } for a publisher winner (numbers filled server-side), or
 * { source_kind, source_id, proposed_format, insight_id?, platform?, metric?, value?, channel_median?, proposed_title?, notes? }.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const body = await readJson(req);
  if (!body) return jsonError('Body must be a JSON object', 400);
  if (!isFormat(body.proposed_format)) return jsonError('proposed_format must be a piece type', 400);

  try {
    if (typeof body.target_id === 'string' && body.target_id) {
      return NextResponse.json(await proposeFromTarget(supabaseAdmin, { targetId: body.target_id, proposedFormat: body.proposed_format }));
    }
    if (!SOURCE_KINDS.includes(body.source_kind) || !strOrNull(body.source_id)) {
      return jsonError('Send target_id, or source_kind and source_id', 400);
    }
    const result = await proposePromotion(supabaseAdmin, {
      sourceKind: body.source_kind,
      sourceId: strOrNull(body.source_id)!,
      proposedFormat: body.proposed_format,
      insightId: strOrNull(body.insight_id),
      platform: strOrNull(body.platform),
      metric: strOrNull(body.metric),
      value: numOrNull(body.value),
      channelMedian: numOrNull(body.channel_median),
      proposedTitle: strOrNull(body.proposed_title),
      notes: strOrNull(body.notes),
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) return jsonError(err.message, 404);
    return serverError('propose promotion', err);
  }
}
