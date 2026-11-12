import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { addExternalWinner } from '@/lib/content/any-to-any/winners';
import { FORM_RANK, type PieceType } from '@/lib/content/any-to-any/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/content/promotions/external → { promotion, created }
 * Body: { url, platform ('reddit' | 'x' | ...), metric, value, channel_median?, title?, text?, insight_id?, format?, source_format? }
 * Reddit can't be read by our tools, so Austin logs Reddit winners here by hand.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const b = await readJson(req);
  if (!b) return jsonError('Body must be a JSON object', 400);

  const url = typeof b.url === 'string' ? b.url.trim() : '';
  if (!/^https?:\/\/\S+$/i.test(url)) return jsonError('A full https:// link to the post is required', 400);
  const value = Number(b.value);
  if (!Number.isFinite(value) || value < 0) return jsonError('value must be a number', 400);
  const median = b.channel_median === undefined || b.channel_median === null || b.channel_median === '' ? null : Number(b.channel_median);
  if (median !== null && (!Number.isFinite(median) || median < 0)) return jsonError('channel_median must be a number', 400);
  const format = b.format && typeof b.format === 'string' && b.format !== 'article' && b.format in FORM_RANK ? (b.format as PieceType) : undefined;
  if (b.format && !format) return jsonError('format must be a piece type', 400);

  try {
    const result = await addExternalWinner(supabaseAdmin, {
      url,
      platform: typeof b.platform === 'string' && b.platform ? b.platform : 'reddit',
      metric: typeof b.metric === 'string' && b.metric ? b.metric : 'upvotes_plus_comments',
      value,
      channelMedian: median,
      title: typeof b.title === 'string' ? b.title : null,
      text: typeof b.text === 'string' ? b.text : null,
      insightId: typeof b.insight_id === 'string' && b.insight_id ? b.insight_id : null,
      format,
      sourceFormat: typeof b.source_format === 'string' ? b.source_format : undefined,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return serverError('add external winner', err);
  }
}
