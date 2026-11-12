import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { runPublisher } from '@/lib/social/engine';
import { jsonError, requireAdmin, serverError } from '@/lib/social/api';
import { loadPost, validateTargets } from '@/lib/social/posts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;

  try {
    const post = await loadPost(supabaseAdmin, id);
    if (!post) return jsonError('Post not found', 404);
    if (post.status === 'published') return jsonError('Post is already published', 409);

    const live = post.targets.filter((t) => t.status !== 'cancelled');
    if (live.length === 0) return jsonError('Pick at least one account to publish to', 400, { errors: { _post: ['No targets'] } });

    const targetErrors = await validateTargets(
      supabaseAdmin,
      post,
      live.map((t) => ({ account_id: t.account_id, format: t.format, caption_override: t.caption_override, options: t.options })),
    );
    if (Object.keys(targetErrors).length) return jsonError('Some channels cannot publish this post', 400, { errors: targetErrors });

    const now = new Date();
    if (post.status === 'cancelled') {
      await supabaseAdmin
        .from('social_post_targets')
        .update({ status: 'pending', attempts: 0, error: null, next_attempt_at: null })
        .eq('post_id', id)
        .eq('status', 'cancelled');
    }
    await supabaseAdmin
      .from('social_posts')
      .update({ status: 'scheduled', scheduled_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', id);

    await runPublisher({ client: supabaseAdmin, now, budgetMs: 60_000, postId: id });
    return NextResponse.json({ post: await loadPost(supabaseAdmin, id) });
  } catch (err) {
    return serverError('publish now', err);
  }
}
