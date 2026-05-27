import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';

const AUDIENCE_TRACKS = ['operator', 'side_builder', 'inside_player', 'almost_builder', 'seeker', 'all'] as const;
const RITES = ['perception', 'orientation', 'declaration'] as const;
const QUESTION_ROLES = ['anchor', 'followup', 'variant'] as const;

const CreateSchema = z.object({
  id: z.string().min(1).max(200),
  product_slug: z.string().min(1).max(200),
  step_index: z.number().int().min(1),
  domain: z.string().min(1).max(200),
  rite: z.enum(RITES),
  question_role: z.enum(QUESTION_ROLES).default('anchor'),
  experience_level: z.number().int().min(1).max(3).default(2),
  audience_tracks: z.array(z.enum(AUDIENCE_TRACKS)).min(1).default(['all']),
  prompt_text: z.string().min(1),
  prompt_variants: z.record(z.string(), z.string()).nullable().optional(),
  followup_text: z.string().nullable().optional(),
  unlocks: z.array(z.string()).nullable().optional(),
  blocks: z.array(z.string()).nullable().optional(),
  signals_extracted: z.array(z.string()).nullable().optional(),
  active: z.boolean().default(true),
});

/**
 * GET /api/admin/question-pool
 * List question_pool rows with optional filters
 */
export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productSlug = searchParams.get('product_slug');
  const stepIndexRaw = searchParams.get('step_index');
  const audienceTrack = searchParams.get('audience_track');
  const activeParam = searchParams.get('active'); // 'true' | 'false' | 'all'

  let query = supabaseAdmin
    .from('question_pool')
    .select('*')
    .order('product_slug', { ascending: true })
    .order('step_index', { ascending: true })
    .order('question_role', { ascending: true });

  if (productSlug) {
    query = query.eq('product_slug', productSlug);
  }

  if (stepIndexRaw) {
    const stepIndex = Number(stepIndexRaw);
    if (!Number.isNaN(stepIndex)) {
      query = query.eq('step_index', stepIndex);
    }
  }

  if (audienceTrack) {
    // Postgres array contains operator — row's audience_tracks must contain this value
    query = query.contains('audience_tracks', [audienceTrack]);
  }

  if (activeParam === 'true') {
    query = query.eq('active', true);
  } else if (activeParam === 'false') {
    query = query.eq('active', false);
  }

  const { data, error: fetchError } = await query;

  if (fetchError) {
    console.error('[Admin API] question_pool fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch question pool' }, { status: 500 });
  }

  return NextResponse.json({ success: true, questions: data ?? [] });
}

/**
 * POST /api/admin/question-pool
 * Create a new pool entry
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

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Check id uniqueness
  const { data: existing } = await supabaseAdmin
    .from('question_pool')
    .select('id')
    .eq('id', data.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'A question with this id already exists' }, { status: 409 });
  }

  const insertRow = {
    id: data.id,
    product_slug: data.product_slug,
    step_index: data.step_index,
    domain: data.domain,
    rite: data.rite,
    question_role: data.question_role,
    experience_level: data.experience_level,
    audience_tracks: data.audience_tracks,
    prompt_text: data.prompt_text,
    prompt_variants: data.prompt_variants ?? null,
    followup_text: data.followup_text ?? null,
    unlocks: data.unlocks ?? null,
    blocks: data.blocks ?? null,
    signals_extracted: data.signals_extracted ?? null,
    active: data.active,
  };

  const { data: question, error: insertError } = await supabaseAdmin
    .from('question_pool')
    .insert(insertRow)
    .select('*')
    .single();

  if (insertError || !question) {
    console.error('[Admin API] question_pool create error:', insertError);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'question_pool_create',
    targetType: 'question_pool',
    targetId: question.id,
    targetName: question.id,
    newValue: { id: question.id, product_slug: question.product_slug, step_index: question.step_index },
  });

  return NextResponse.json({ success: true, question }, { status: 201 });
}
