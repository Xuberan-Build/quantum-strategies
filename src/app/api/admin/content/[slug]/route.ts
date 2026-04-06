import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  excerpt: z.string().max(1000).optional().nullable(),
  body: z.string().optional(),
  author: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).optional(),
  is_published: z.boolean().optional(),
});

/**
 * GET /api/admin/content/[slug]
 * Retrieve a single post including body
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { slug } = await params;

  const { data: post, error: fetchError } = await supabaseAdmin
    .from('content_posts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, post });
}

/**
 * PUT /api/admin/content/[slug]
 * Update a post
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { slug } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdatePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const { data: current, error: fetchError } = await supabaseAdmin
    .from('content_posts')
    .select('id, title, is_published')
    .eq('slug', slug)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const updates = parsed.data;
  const updateData: Record<string, unknown> = { ...updates };

  // Set published_at when first publishing
  if (updates.is_published === true && !current.is_published) {
    updateData.published_at = new Date().toISOString();
  }
  // Clear published_at when unpublishing
  if (updates.is_published === false) {
    updateData.published_at = null;
  }

  const { error: updateError } = await supabaseAdmin
    .from('content_posts')
    .update(updateData)
    .eq('slug', slug);

  if (updateError) {
    console.error('[Admin API] Update post error:', updateError);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'content_update',
    targetType: 'content_post',
    targetId: current.id,
    targetName: current.title,
    previousValue: { is_published: current.is_published },
    newValue: Object.fromEntries(Object.keys(updates).map((k) => [k, updates[k as keyof typeof updates]])),
  });

  return NextResponse.json({ success: true, slug });
}

/**
 * DELETE /api/admin/content/[slug]
 * Delete a post
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { slug } = await params;

  const { data: current, error: fetchError } = await supabaseAdmin
    .from('content_posts')
    .select('id, title')
    .eq('slug', slug)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('content_posts')
    .delete()
    .eq('slug', slug);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'content_delete',
    targetType: 'content_post',
    targetId: current.id,
    targetName: current.title,
    previousValue: { slug },
    newValue: undefined,
  });

  return NextResponse.json({ success: true });
}
