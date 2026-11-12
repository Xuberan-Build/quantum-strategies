import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { ExtractError, extractInsightsFromArticle } from '@/lib/content/any-to-any/extract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/** POST { postId } → { post: { id, slug, title }, candidates: InsightCandidate[] }. Nothing is saved. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const raw = await readJson(req);
  if (!raw || typeof raw.postId !== 'string') return jsonError('postId is required', 400);
  try {
    const result = await extractInsightsFromArticle(supabaseAdmin, raw.postId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ExtractError) return jsonError(err.message, err.status);
    return serverError('extract insights', err);
  }
}
