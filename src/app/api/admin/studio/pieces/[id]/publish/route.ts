import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { publish = false, slug_override } = await req.json().catch(() => ({}));

  // Load piece and walk up the hierarchy for pillar/topic context
  const { data: piece, error } = await supabaseAdmin
    .from('content_pieces')
    .select(`
      *,
      content_angles!inner(
        id, title, topic_id,
        content_topics(id, pillar_id)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !piece) {
    return NextResponse.json({ error: 'Piece not found' }, { status: 404 });
  }

  const angle = piece.content_angles as {
    id: string; title: string; topic_id: string | null;
    content_topics: { id: string; pillar_id: string | null } | null;
  };

  const topicId  = angle?.topic_id ?? null;
  const pillarId = angle?.content_topics?.pillar_id ?? null;

  // Generate slug from piece title, falling back to angle title
  const baseTitle = piece.title || angle?.title || 'untitled';
  const slug = slug_override || baseTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  const now = new Date().toISOString();

  // Upsert into content_posts (conflict on piece_id if already published, else slug)
  const { data: existingPost } = await supabaseAdmin
    .from('content_posts')
    .select('id, slug')
    .eq('piece_id', id)
    .maybeSingle();

  let post;
  if (existingPost) {
    // Update existing
    const { data, error: updateErr } = await supabaseAdmin
      .from('content_posts')
      .update({
        title: piece.title || angle?.title,
        body: piece.body ?? '',
        is_published: publish,
        published_at: publish ? (existingPost ? undefined : now) : null,
        updated_at: now,
      })
      .eq('id', existingPost.id)
      .select()
      .single();
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    post = data;
  } else {
    // Create new
    const { data, error: insertErr } = await supabaseAdmin
      .from('content_posts')
      .insert({
        slug,
        type: 'blog',
        title: piece.title || angle?.title || 'Untitled',
        excerpt: (piece.body ?? '').slice(0, 200).replace(/\n/g, ' '),
        body: piece.body ?? '',
        pillar_id: pillarId,
        topic_id: topicId,
        piece_id: id,
        is_published: publish,
        published_at: publish ? now : null,
        tags: [],
      })
      .select()
      .single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    post = data;
  }

  // Update piece status
  await supabaseAdmin
    .from('content_pieces')
    .update({ status: publish ? 'published' : 'review' })
    .eq('id', id);

  return NextResponse.json({ post, slug: post.slug });
}
