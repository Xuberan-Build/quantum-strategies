import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { createInsight, parseInsightInput, type InsightInput } from '@/lib/content/any-to-any/insights';
import { isUuid, linkAssets } from '@/lib/content/any-to-any/graph';
import type { Insight } from '@/lib/content/any-to-any/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST { postId?, insights: InsightInput[] } → 201 { insights } (400 { errors: { index: string[] } } when any item is invalid; nothing saved)
 * Saves accepted extract candidates: source_kind 'article', source_post_id = postId (or each item's own),
 * and an article → insight link with direction 'same'.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const raw = await readJson(req);
  if (!raw || !Array.isArray(raw.insights) || raw.insights.length === 0) return jsonError('insights must be a non-empty array', 400);
  if (raw.insights.length > 50) return jsonError('At most 50 insights per request', 400);
  const postId = raw.postId ?? null;
  if (postId !== null && !isUuid(postId)) return jsonError('postId must be a uuid', 400);

  const parsed: InsightInput[] = [];
  const errors: Record<number, string[]> = {};
  raw.insights.forEach((item: unknown, i: number) => {
    if (!item || typeof item !== 'object') return void (errors[i] = ['must be an object']);
    const { value, errors: errs } = parseInsightInput({ source_post_id: postId, ...(item as Record<string, unknown>) });
    if (!value) return void (errors[i] = errs);
    if (value.source_post_id) value.source_kind = 'article';
    parsed.push(value as InsightInput);
  });
  if (Object.keys(errors).length) return jsonError('Some insights are invalid', 400, { errors });

  try {
    if (postId) {
      const { data: post } = await supabaseAdmin.from('content_posts').select('id').eq('id', postId).maybeSingle();
      if (!post) return jsonError('Article not found', 404);
    }
    const saved: Insight[] = [];
    for (const input of parsed) {
      const insight = await createInsight(supabaseAdmin, input, auth.admin.id);
      saved.push(insight);
      if (insight.source_post_id) {
        await linkAssets(supabaseAdmin, {
          from: { kind: 'article', id: insight.source_post_id },
          to: { kind: 'insight', id: insight.id },
          direction: 'same',
          insightId: insight.id,
          createdBy: auth.admin.id,
        });
      }
    }
    return NextResponse.json({ insights: saved }, { status: 201 });
  } catch (err) {
    return serverError('bulk save insights', err);
  }
}
