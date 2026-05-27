/**
 * POST /api/dynamic-step/extract-signals
 *
 * Given a user's response text and a set of allowed signal vocabulary,
 * calls OpenAI gpt-4o-mini to extract structured signals, validates them,
 * persists each to session_signals, and returns the parsed array.
 *
 * Manual test (replace values with real session data):
 *
 * curl -X POST http://localhost:3000/api/dynamic-step/extract-signals \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: <your-supabase-auth-cookie>" \
 *   -d '{
 *     "productSessionId": "00000000-0000-0000-0000-000000000001",
 *     "stepIndex": 1,
 *     "response": "I feel a deep pull toward building something that lasts, even though fear keeps showing up.",
 *     "signalsToExtract": ["clarity", "resistance", "purpose", "fear"]
 *   }'
 *
 * Expected 200:
 * {
 *   "extracted": [
 *     { "signal": "resistance", "confidence": 0.9, "evidence": "fear keeps showing up" },
 *     { "signal": "purpose", "confidence": 0.8, "evidence": "building something that lasts" }
 *   ]
 * }
 *
 * Expected 400: { "error": "productSessionId, stepIndex, response, and signalsToExtract are required" }
 * Expected 401: { "error": "Unauthorized" }
 * Expected 403: { "error": "Unauthorized access to session" }
 * Expected 502: { "error": "Signal extraction failed", "detail": "..." }
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';
import { openai } from '@/lib/openai/client';
import { validateUserInput } from '@/lib/security/input-validation';

const SIGNAL_EXTRACTION_SYSTEM_PROMPT = `You are a signal extractor. Read the user response and return signals from the allowed vocabulary that you can support with evidence quoted from the response. Output ONLY valid JSON.

Allowed signals: {{SIGNALS_TO_EXTRACT_JSON}}

Response format:
{
  "signals": [
    { "signal": "<from allowed vocabulary>", "confidence": <0.0-1.0>, "evidence": "<quoted snippet, <=80 chars>" }
  ]
}

Rules:
- Only output signals from the allowed vocabulary.
- confidence reflects how strongly the response supports the signal.
- Skip signals you cannot quote evidence for.
- If no signals match, return { "signals": [] }.`;

interface ExtractedSignal {
  signal: string;
  confidence: number;
  evidence: string;
}

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
    const { productSessionId, stepIndex, response, signalsToExtract } = body || {};

    if (
      !productSessionId ||
      typeof productSessionId !== 'string' ||
      stepIndex === undefined ||
      typeof stepIndex !== 'number' ||
      !Number.isInteger(stepIndex) ||
      stepIndex < 1 ||
      !response ||
      typeof response !== 'string' ||
      !Array.isArray(signalsToExtract) ||
      signalsToExtract.length === 0 ||
      signalsToExtract.some((s) => typeof s !== 'string')
    ) {
      return NextResponse.json(
        { error: 'productSessionId, stepIndex, response, and signalsToExtract are required' },
        { status: 400 }
      );
    }

    // 1. Verify session belongs to the authenticated user
    const { data: sessionRow, error: sessionError } = await supabaseAdmin
      .from('product_sessions')
      .select('user_id')
      .eq('id', productSessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('[dynamic-step/extract-signals] Session lookup error:', sessionError);
      return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
    }

    if (!sessionRow || sessionRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to session' }, { status: 403 });
    }

    // 2. Sanitize user input before sending to the LLM
    const inputValidation = validateUserInput(response, { maxLength: 3000 });
    if (!inputValidation.isValid) {
      console.warn('[dynamic-step/extract-signals] Input validation warnings:', inputValidation.warnings);
    }
    const sanitizedResponse = inputValidation.sanitized;

    // 3. Call OpenAI gpt-4o-mini to extract signals
    const systemPrompt = SIGNAL_EXTRACTION_SYSTEM_PROMPT.replace(
      '{{SIGNALS_TO_EXTRACT_JSON}}',
      JSON.stringify(signalsToExtract)
    );

    let rawContent: string;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitizedResponse },
        ],
      });
      rawContent = completion.choices[0]?.message?.content ?? '';
    } catch (err: any) {
      console.error('[dynamic-step/extract-signals] OpenAI call failed:', err?.message || err);
      return NextResponse.json(
        { error: 'Signal extraction failed', detail: err?.message || 'OpenAI request error' },
        { status: 502 }
      );
    }

    // 4. Parse JSON and validate each signal is in the allowed list
    let parsed: { signals?: ExtractedSignal[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error('[dynamic-step/extract-signals] Failed to parse OpenAI JSON response:', rawContent);
      return NextResponse.json(
        { error: 'Signal extraction failed', detail: 'Model returned non-JSON output' },
        { status: 502 }
      );
    }

    const allowedSet = new Set(signalsToExtract);
    const validSignals: ExtractedSignal[] = (parsed?.signals ?? []).filter(
      (item): item is ExtractedSignal =>
        typeof item?.signal === 'string' &&
        allowedSet.has(item.signal) &&
        typeof item?.confidence === 'number' &&
        typeof item?.evidence === 'string'
    );

    // 5. Persist each valid signal to session_signals
    if (validSignals.length > 0) {
      const rows = validSignals.map((s) => ({
        session_id: productSessionId,
        step_index: stepIndex,
        signal: s.signal,
        confidence: s.confidence,
        evidence: s.evidence,
        source: 'extraction',
      }));

      const { error: insertError } = await supabaseAdmin
        .from('session_signals')
        .insert(rows);

      if (insertError) {
        // Log but don't fail — signals are useful even if persistence fails
        console.error('[dynamic-step/extract-signals] Failed to persist signals:', insertError);
      }
    }

    return NextResponse.json({ extracted: validSignals });
  } catch (err: any) {
    console.error('[dynamic-step/extract-signals] Unexpected error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Failed to extract signals' },
      { status: 500 }
    );
  }
}
