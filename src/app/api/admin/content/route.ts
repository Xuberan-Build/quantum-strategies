import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';

const CreatePostSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  type: z.enum(['blog', 'whitepaper', 'resource']),
  title: z.string().min(1).max(500),
  excerpt: z.string().max(1000).optional().nullable(),
  body: z.string().default(''),
  author: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).default([]),
  is_published: z.boolean().default(false),
});

/**
 * GET /api/admin/content
 * List all posts with optional type filter
 */
export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const published = searchParams.get('published');

  let query = supabaseAdmin
    .from('content_posts')
    .select('id, slug, type, title, excerpt, author, tags, is_published, published_at, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (type && ['blog', 'whitepaper', 'resource'].includes(type)) {
    query = query.eq('type', type);
  }

  if (published === 'true') {
    query = query.eq('is_published', true);
  } else if (published === 'false') {
    query = query.eq('is_published', false);
  }

  const { data, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }

  return NextResponse.json({ success: true, posts: data });
}

/**
 * POST /api/admin/content
 * Create a new post
 */
export async function POST(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreatePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  // Check slug uniqueness
  const { data: existing } = await supabaseAdmin
    .from('content_posts')
    .select('id')
    .eq('slug', data.slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'A post with this slug already exists' }, { status: 409 });
  }

  const { data: post, error: insertError } = await supabaseAdmin
    .from('content_posts')
    .insert({
      ...data,
      published_at: data.is_published ? new Date().toISOString() : null,
    })
    .select('id, slug, type, title')
    .single();

  if (insertError || !post) {
    console.error('[Admin API] Create post error:', insertError);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'content_create',
    targetType: 'content_post',
    targetId: post.id,
    targetName: post.title,
    previousValue: undefined,
    newValue: { slug: post.slug, type: post.type },
  });

  return NextResponse.json({ success: true, post }, { status: 201 });
}
