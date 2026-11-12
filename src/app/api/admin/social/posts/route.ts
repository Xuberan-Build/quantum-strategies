import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { insertTargets, listPosts, loadPost, parsePostBody, validateTargets, validateTargetsLoose } from '@/lib/social/posts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const sp = req.nextUrl.searchParams;
  try {
    const posts = await listPosts(supabaseAdmin, {
      from: sp.get('from'),
      to: sp.get('to'),
      status: sp.get('status'),
      platform: sp.get('platform'),
    });
    return NextResponse.json({ posts });
  } catch (err) {
    return serverError('list posts', err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const raw = await readJson(req);
  if (!raw) return jsonError('Body must be a JSON object', 400);
  const { value, errors } = parsePostBody(raw, { partial: false });
  if (!value) return jsonError(errors.join('; '), 400, { errors: { _post: errors } });

  const targets = value.targets ?? [];
  if (value.status === 'scheduled') {
    const problems: string[] = [];
    if (targets.length === 0) problems.push('Pick at least one account to schedule');
    if (!value.scheduled_at) problems.push('scheduled_at is required to schedule');
    if (problems.length) return jsonError(problems.join('; '), 400, { errors: { _post: problems } });
  }

  try {
    const targetErrors = value.status === 'scheduled'
      ? await validateTargets(supabaseAdmin, { caption: value.caption!, media: value.media ?? [], link: value.link ?? null, first_comment: value.first_comment ?? null, tags: value.tags ?? [], title: value.title ?? null }, targets)
      : await validateTargetsLoose(supabaseAdmin, targets);
    if (Object.keys(targetErrors).length) return jsonError('Some channels cannot publish this post', 400, { errors: targetErrors });

    const { data: post, error } = await supabaseAdmin
      .from('social_posts')
      .insert({
        piece_id: value.piece_id ?? null,
        title: value.title ?? null,
        caption: value.caption,
        media: value.media ?? [],
        link: value.link ?? null,
        first_comment: value.first_comment ?? null,
        tags: value.tags ?? [],
        status: value.status,
        scheduled_at: value.scheduled_at ?? null,
        created_by: auth.admin.id,
      })
      .select('id')
      .single();
    if (error || !post) throw new Error(error?.message ?? 'insert failed');

    try {
      await insertTargets(supabaseAdmin, post.id, targets);
    } catch (err) {
      await supabaseAdmin.from('social_posts').delete().eq('id', post.id);
      throw err;
    }
    return NextResponse.json({ post: await loadPost(supabaseAdmin, post.id) }, { status: 201 });
  } catch (err) {
    return serverError('create post', err);
  }
}
