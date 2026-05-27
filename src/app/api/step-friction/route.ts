/**
 * POST /api/step-friction
 *
 * User-facing endpoint. Called when a customer clicks "flag this step".
 * Inserts a row into step_friction_log with status='new'.
 *
 * Manual verification:
 *
 * curl -X POST http://localhost:3000/api/step-friction \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: <your-supabase-auth-cookie>" \
 *   -d '{
 *     "productSessionId": "00000000-0000-0000-0000-000000000001",
 *     "productSlug": "quantum-initiation",
 *     "stepIndex": 2,
 *     "reason": "unclear",
 *     "note": "Not sure what this is asking",
 *     "responseExcerpt": "I was trying to say..."
 *   }'
 *
 * Expected 200: { "ok": true, "id": "<uuid>" }
 * Expected 400: { "error": "productSessionId, productSlug, stepIndex, and reason are required" }
 * Expected 401: { "error": "Unauthorized" }
 * Expected 403: { "error": "Unauthorized access to session" }
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';

const VALID_REASONS = ['tedious', 'unclear', 'other'] as const;
type FrictionReason = (typeof VALID_REASONS)[number];

export async function POST(req: Request) {
  try {
    // Auth
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { productSessionId, productSlug, stepIndex, reason, note, responseExcerpt } = body ?? {};

    // Validate required fields
    if (
      !productSessionId ||
      typeof productSessionId !== 'string' ||
      !productSlug ||
      typeof productSlug !== 'string' ||
      stepIndex === undefined ||
      typeof stepIndex !== 'number' ||
      !Number.isInteger(stepIndex) ||
      stepIndex < 0 ||
      !reason ||
      typeof reason !== 'string' ||
      !(VALID_REASONS as readonly string[]).includes(reason)
    ) {
      return NextResponse.json(
        {
          error:
            'productSessionId, productSlug, stepIndex, and reason are required. reason must be one of: tedious, unclear, other',
        },
        { status: 400 }
      );
    }

    // Validate optional string fields if provided
    if (note !== undefined && typeof note !== 'string') {
      return NextResponse.json({ error: 'note must be a string' }, { status: 400 });
    }
    if (responseExcerpt !== undefined && typeof responseExcerpt !== 'string') {
      return NextResponse.json({ error: 'responseExcerpt must be a string' }, { status: 400 });
    }

    // Verify product_session ownership
    const { data: sessionRow, error: sessionError } = await supabaseAdmin
      .from('product_sessions')
      .select('user_id')
      .eq('id', productSessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('[step-friction] Session lookup error:', sessionError);
      return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
    }

    if (!sessionRow || sessionRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to session' }, { status: 403 });
    }

    // Insert friction log entry
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('step_friction_log')
      .insert({
        user_id: user.id,
        product_session_id: productSessionId,
        product_slug: productSlug as string,
        step_index: stepIndex as number,
        reason: reason as FrictionReason,
        note: (note as string | undefined) ?? null,
        response_excerpt: (responseExcerpt as string | undefined) ?? null,
        status: 'new',
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('[step-friction] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to log friction' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[step-friction] Unexpected error:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
