import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { insertTargets, loadPost, parsePostBody, validateTargets, validateTargetsLoose, type TargetInput } from '@/lib/social/posts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const post = await loadPost(supabaseAdmin, (await params).id);
  if (!post) return jsonError('Post not found', 404);
  return NextResponse.json({ post });
}

async function cancelPost(id: string) {
  await supabaseAdmin
    .from('social_post_targets')
    .update({ status: 'cancelled', next_attempt_at: null })
    .eq('post_id', id)
    .in('status', ['pending', 'processing', 'needs_action', 'failed']);
  await supabaseAdmin.from('social_posts').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;

  const raw = await readJson(req);
  if (!raw) return jsonError('Body must be a JSON object', 400);
  const { value, errors } = parsePostBody(raw, { partial: true });
  if (!value) return jsonError(errors.join('; '), 400, { errors: { _post: errors } });

  try {
    const current = await loadPost(supabaseAdmin, id);
    if (!current) return jsonError('Post not found', 404);

    if (current.status === 'published' || current.status === 'publishing') {
      const onlyCancel = value.status === 'cancelled' && current.status === 'publishing' && Object.keys(value).length === 1;
      if (!onlyCancel) return jsonError(`A ${current.status} post cannot be edited`, 409);
    }
    if (value.status === 'cancelled') {
      await cancelPost(id);
      return NextResponse.json({ post: await loadPost(supabaseAdmin, id) });
    }

    const merged = {
      caption: value.caption ?? current.caption,
      media: value.media ?? current.media,
      link: value.link !== undefined ? value.link : current.link,
      first_comment: value.first_comment !== undefined ? value.first_comment : current.first_comment,
      tags: value.tags ?? current.tags,
      title: value.title !== undefined ? value.title : current.title,
    };
    const status = value.status ?? (current.status === 'cancelled' ? 'draft' : current.status);
    const scheduledAt = value.scheduled_at !== undefined ? value.scheduled_at : current.scheduled_at;
    const targets: TargetInput[] = value.targets ?? current.targets.map((t) => ({
      account_id: t.account_id, format: t.format, caption_override: t.caption_override, options: t.options,
    }));

    if (status === 'scheduled') {
      const problems: string[] = [];
      if (targets.length === 0) problems.push('Pick at least one account to schedule');
      if (!scheduledAt) problems.push('scheduled_at is required to schedule');
      if (problems.length) return jsonError(problems.join('; '), 400, { errors: { _post: problems } });
    }
    const targetErrors = status === 'scheduled'
      ? await validateTargets(supabaseAdmin, { ...merged, id }, targets)
      : value.targets ? await validateTargetsLoose(supabaseAdmin, targets) : {};
    if (Object.keys(targetErrors).length) return jsonError('Some channels cannot publish this post', 400, { errors: targetErrors });

    const patch: Record<string, unknown> = { ...merged, status, scheduled_at: scheduledAt, updated_at: new Date().toISOString() };
    if (value.piece_id !== undefined) patch.piece_id = value.piece_id;
    const { error } = await supabaseAdmin.from('social_posts').update(patch).eq('id', id);
    if (error) throw new Error(error.message);

    if (value.targets) {
      await supabaseAdmin.from('social_post_targets').delete().eq('post_id', id);
      await insertTargets(supabaseAdmin, id, value.targets);
    } else if (current.status === 'cancelled') {
      await supabaseAdmin
        .from('social_post_targets')
        .update({ status: 'pending', attempts: 0, error: null, next_attempt_at: null })
        .eq('post_id', id)
        .eq('status', 'cancelled');
    }
    return NextResponse.json({ post: await loadPost(supabaseAdmin, id) });
  } catch (err) {
    return serverError('update post', err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const { data: post } = await supabaseAdmin.from('social_posts').select('id, status').eq('id', id).maybeSingle();
    if (!post) return jsonError('Post not found', 404);
    if (post.status === 'published' || post.status === 'partial') return jsonError('Published posts cannot be deleted', 409);
    if (post.status === 'draft' || post.status === 'cancelled') {
      await supabaseAdmin.from('social_posts').delete().eq('id', id);
      return NextResponse.json({ ok: true, deleted: true });
    }
    await cancelPost(id);
    return NextResponse.json({ ok: true, cancelled: true });
  } catch (err) {
    return serverError('delete post', err);
  }
}
