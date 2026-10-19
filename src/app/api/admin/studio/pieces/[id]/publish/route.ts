import { NextRequest, NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import {
  excerptFrom,
  nextPublishedAt,
  postTypeForPiece,
  resolvePillarId,
  sanitizeMarkdownForMdx,
  slugify,
} from '@/lib/content/publish';
import { articleChangeUrls, notifyIndexNow } from '@/lib/seo/indexnow';

type Params = { params: Promise<{ id: string }> };

type PieceWithAngle = {
  id: string;
  piece_type: string;
  title: string | null;
  body: string | null;
  content_angles: {
    id: string;
    title: string;
    topic_id: string | null;
    metadata: unknown;
    content_topics: { id: string; pillar_id: string | null } | null;
  } | null;
};

export async function POST(req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { id } = await params;
  const { publish = false, slug_override } = await req.json().catch(() => ({}));

  // Load piece and walk up the hierarchy for pillar/topic context
  const { data, error } = await supabaseAdmin
    .from('content_pieces')
    .select(`
      id, piece_type, title, body,
      content_angles!inner(
        id, title, topic_id, metadata,
        content_topics(id, pillar_id)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Piece not found' }, { status: 404 });
  }
  const piece = data as unknown as PieceWithAngle;
  const angle = piece.content_angles;

  // Only article-shaped pieces become posts; a thread or email is never an article.
  const postType = postTypeForPiece(piece.piece_type);
  if (!postType) {
    return NextResponse.json(
      { error: `A ${piece.piece_type} piece can't be published as an article. Copy it out or send it through a campaign.` },
      { status: 400 },
    );
  }

  const topicId = angle?.topic_id ?? null;
  const pillarId = resolvePillarId(angle?.content_topics?.pillar_id, angle?.metadata);

  const title = piece.title || angle?.title || 'Untitled';
  const slug = (typeof slug_override === 'string' && slugify(slug_override)) || slugify(title) || `post-${id.slice(0, 8)}`;

  // Model output is markdown; make it safe for the MDX renderer before it goes live.
  const body = sanitizeMarkdownForMdx(piece.body ?? '');
  const excerpt = excerptFrom(piece.body ?? '');
  const now = new Date().toISOString();

  const { data: existingPost } = await supabaseAdmin
    .from('content_posts')
    .select('id, slug, published_at')
    .eq('piece_id', id)
    .maybeSingle();

  let post: { slug: string } & Record<string, unknown>;
  if (existingPost) {
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('content_posts')
      .update({
        title,
        type: postType,
        excerpt,
        body,
        pillar_id: pillarId,
        topic_id: topicId,
        is_published: publish,
        published_at: nextPublishedAt(publish, existingPost.published_at, now),
        updated_at: now,
      })
      .eq('id', existingPost.id)
      .select()
      .single();
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    post = updated;
  } else {
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('content_posts')
      .insert({
        slug,
        type: postType,
        title,
        excerpt,
        body,
        pillar_id: pillarId,
        topic_id: topicId,
        piece_id: id,
        is_published: publish,
        published_at: nextPublishedAt(publish, null, now),
        tags: [],
      })
      .select()
      .single();
    if (insertErr) {
      const message = insertErr.code === '23505' ? `The slug "${slug}" is already taken. Pass slug_override.` : insertErr.message;
      return NextResponse.json({ error: message }, { status: insertErr.code === '23505' ? 409 : 500 });
    }
    post = inserted;
  }

  // Update piece status
  const { error: statusErr } = await supabaseAdmin
    .from('content_pieces')
    .update({ status: publish ? 'published' : 'review' })
    .eq('id', id);
  if (statusErr) console.error('[publish] piece status update failed', statusErr);

  // /articles, the article page and the sitemap are statically rendered; refresh them now
  // instead of waiting for the next deploy.
  revalidatePath('/articles');
  revalidatePath(`/articles/${post.slug}`);
  revalidatePath('/sitemap.xml');

  // Tell IndexNow engines (Bing, Yandex, ...) the article changed. Best effort, after the response:
  // a failure here never blocks publishing. Drafts saved for review are not pinged.
  if (publish && postType === 'blog') after(() => notifyIndexNow(articleChangeUrls(post.slug)));

  return NextResponse.json({ post, slug: post.slug });
}
