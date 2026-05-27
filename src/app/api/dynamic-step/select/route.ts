/**
 * POST /api/dynamic-step/select
 *
 * Given a product session and a step index, return the best question from
 * the question_pool for that step.
 *
 * Manual test (replace UUIDs and slug with real values):
 *
 * curl -X POST http://localhost:3000/api/dynamic-step/select \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: <your-supabase-auth-cookie>" \
 *   -d '{
 *     "productSessionId": "00000000-0000-0000-0000-000000000001",
 *     "productSlug": "quantum-initiation",
 *     "stepIndex": 1
 *   }'
 *
 * Expected 200:
 * {
 *   "questionId": "<uuid>",
 *   "promptText": "What drew you to this moment?",
 *   "followupText": null,
 *   "audienceTrack": "unknown",
 *   "signalsToExtract": ["clarity", "resistance"]
 * }
 *
 * Expected 400: { "error": "productSessionId, productSlug, and stepIndex are required" }
 * Expected 401: { "error": "Unauthorized" }
 * Expected 404: { "error": "No matching question found for this step" }
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    // Auth
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate body
    const body = await req.json();
    const { productSessionId, productSlug, stepIndex } = body || {};

    if (
      !productSessionId ||
      typeof productSessionId !== 'string' ||
      !productSlug ||
      typeof productSlug !== 'string' ||
      stepIndex === undefined ||
      typeof stepIndex !== 'number' ||
      !Number.isInteger(stepIndex) ||
      stepIndex < 1
    ) {
      return NextResponse.json(
        { error: 'productSessionId, productSlug, and stepIndex are required' },
        { status: 400 }
      );
    }

    // 1. Resolve the audience_track for this session
    const { data: sessionRow, error: sessionError } = await supabaseAdmin
      .from('product_sessions')
      .select('audience_track, user_id')
      .eq('id', productSessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('[dynamic-step/select] Session lookup error:', sessionError);
      return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
    }

    // Verify ownership
    if (!sessionRow || sessionRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to session' }, { status: 403 });
    }

    const audienceTrack: string = sessionRow.audience_track ?? 'unknown';

    // 2. Query question_pool for active rows matching slug + step
    const { data: candidates, error: poolError } = await supabaseAdmin
      .from('question_pool')
      .select('id, prompt_text, followup_text, prompt_variants, question_role, audience_tracks, signals_extracted')
      .eq('product_slug', productSlug)
      .eq('step_index', stepIndex)
      .eq('is_active', true);

    if (poolError) {
      console.error('[dynamic-step/select] question_pool query error:', poolError);
      return NextResponse.json({ error: 'Failed to query question pool' }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json(
        { error: 'No matching question found for this step' },
        { status: 404 }
      );
    }

    // 3. Pick the best candidate
    //    Priority: track-specific anchor > track-specific other > 'all' anchor > 'all' other
    //    TODO: incorporate signal-based scoring once session_signals are populated
    //    TODO: evaluate unlocks/blocks fields once the schema is finalised
    const trackSpecific = candidates.filter(
      (c) => Array.isArray(c.audience_tracks) && c.audience_tracks.includes(audienceTrack)
    );
    const allTrack = candidates.filter(
      (c) => Array.isArray(c.audience_tracks) && c.audience_tracks.includes('all')
    );

    const preferAnchor = (list: typeof candidates) =>
      list.find((c) => c.question_role === 'anchor') ?? list[0] ?? null;

    const chosen =
      preferAnchor(trackSpecific) ??
      preferAnchor(allTrack) ??
      candidates[0];

    if (!chosen) {
      return NextResponse.json(
        { error: 'No matching question found for this step' },
        { status: 404 }
      );
    }

    // 4. Resolve prompt text — prefer track-specific variant if available
    let promptText: string = chosen.prompt_text;
    if (chosen.prompt_variants && typeof chosen.prompt_variants === 'object') {
      const variant = (chosen.prompt_variants as Record<string, string>)[audienceTrack];
      if (variant) {
        promptText = variant;
      }
    }

    return NextResponse.json({
      questionId: chosen.id,
      promptText,
      followupText: chosen.followup_text ?? null,
      audienceTrack,
      signalsToExtract: Array.isArray(chosen.signals_extracted) ? chosen.signals_extracted : [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to select question';
    console.error('[dynamic-step/select] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
