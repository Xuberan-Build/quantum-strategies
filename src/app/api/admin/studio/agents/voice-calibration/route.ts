import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getVoicePack, findBannedTerms, findPatternMatches, type VoicePack } from '@/lib/content/voice-pack';

const FAST_MODEL = 'gpt-4o-mini';

type Violation = { type: string; excerpt: string; suggestion: string };

/** Rubric for the model. Voice rules, banned terms and care rules come from the voice pack. */
function buildRubric(pack: VoicePack): string {
  const banned = pack.bannedTerms.map((t) => `"${t}"`).join(', ');
  const care = pack.handleWithCare.map((h) => `- ${h.term}: ${h.rule}`).join('\n');
  return `You are a voice calibration auditor for long-form content. Score content 0–100 against these criteria:

1. SECOND-PERSON (25 pts): Is 'you'/'your' the dominant address? Penalty for 'one' or for talking about the reader in the third person. 'We' is fine when it means the brand or its community, never for the reader's own experience.
2. EXPERIENCE FIRST, SOURCES PLAINLY (25 pts): Does authority come from lived experience first? When a claim needs backing, is the source named plainly (who found it; research or practitioner model)? Score HOW sources are used, not WHETHER: penalise citations stacked or name-dropped to impress, and unsupported claims presented as fact. Never penalise a plainly named source.
3. SINCERITY OVER CLEVERNESS (25 pts): Does the writing value substance and directness over wordplay, metaphor stacking, or rhetorical flourish?
4. FORWARD MOMENTUM (25 pts): Does each sentence advance the argument? No throat-clearing, no summarizing what was just said.

THE BRAND'S VOICE RULES (flag clear breaches as violations):
${pack.voiceRules.map((r) => `- ${r}`).join('\n')}
${care ? `\nHANDLE WITH CARE (flag uses that break the condition):\n${care}\n` : ''}${pack.chartPolicy ? `\nCHARTS AND PROFILES: ${pack.chartPolicy}\n` : ''}
Also check for these forbidden patterns (automatic deductions):
- Rhetorical triads: three parallel comma-separated items ("X, Y, and Z") used for rhythm. Structural threes (named, numbered, separate beats) and proper nouns are exempt.
- Exclamation points used for emphasis (not mid-sentence dialogue)
${banned ? `- Banned phrases: ${banned}` : ''}

Return JSON:
{
  "score": 0-100,
  "violations": [
    { "type": "second_person | experience_and_sources | sincerity | momentum | triad | forbidden_phrase | exclamation | voice_rule | handle_with_care", "excerpt": "the offending text (max 80 chars)", "suggestion": "how to fix it in one sentence" }
  ],
  "strengths": ["what the content does well (2-4 items)"],
  "overall_note": "one sentence calibration note for the writer"
}`;
}

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { content, angle_id } = body ?? {};

  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const pack = await getVoicePack();

  // ── Exact-match pre-check (deterministic, from the voice pack) ────────────
  const bannedHits = findBannedTerms(content, pack);
  const ctaHits = findPatternMatches(content, pack.ctaSpamPatterns);
  const timeboxHits = findPatternMatches(content, pack.outcomeTimeboxPatterns);

  // ── Semantic scoring via model ─────────────────────────────────────────────
  let modelResult: {
    score?: number;
    violations?: Violation[];
    strengths?: string[];
    overall_note?: string;
  };

  try {
    const completion = await openai.chat.completions.create({
      model: FAST_MODEL,
      response_format: { type: 'json_object' },
      max_completion_tokens: 800,
      temperature: 0.1,
      messages: [
        { role: 'system', content: buildRubric(pack) },
        { role: 'user', content: `Score this content:\n\n${content.slice(0, 3000)}` },
      ],
    });

    modelResult = JSON.parse(completion.choices[0].message.content ?? '{}');
  } catch (err) {
    console.error('[voice-calibration agent]', err);
    return NextResponse.json(
      { error: 'Model call failed', detail: err instanceof Error ? err.message : undefined },
      { status: 500 },
    );
  }

  // ── Merge deterministic hits with model violations ────────────────────────
  const deterministic: Violation[] = [
    ...bannedHits.map((v) => ({
      type: 'forbidden_phrase',
      excerpt: v.excerpt,
      suggestion: `Remove "${v.match}" — use a direct declarative statement instead`,
    })),
    ...ctaHits.map((v) => ({
      type: 'cta_spam_pattern',
      excerpt: v.excerpt,
      suggestion: `"${v.match}" reads like spam CTA copy. Say what the next step measures, how long it takes and what the reader gets.`,
    })),
    ...timeboxHits.map((v) => ({
      type: 'outcome_timebox',
      excerpt: v.excerpt,
      suggestion: `"${v.match}" promises outcome speed. Timebox the practice, not the result.`,
    })),
  ];

  const allViolations = [...deterministic, ...(Array.isArray(modelResult.violations) ? modelResult.violations : [])];

  // Deduct 5 points per deterministic hit (the model may miss exact phrases)
  const baseScore = typeof modelResult.score === 'number' ? modelResult.score : 0;
  const adjustedScore = Math.max(0, Math.min(100, baseScore - deterministic.length * 5));

  // ── Log agent run if angle_id provided ────────────────────────────────────
  if (angle_id) {
    try {
      await supabaseAdmin
        .from('content_agent_runs')
        .insert({
          content_angle_id: angle_id,
          agent_type: 'voice_calibration',
          status: 'completed',
          input: { content_length: content.length, voice_pack_version: pack.version },
          output: { score: adjustedScore, violation_count: allViolations.length },
          completed_at: new Date().toISOString(),
        });
    } catch { /* table not yet migrated */ }
  }

  return NextResponse.json({
    score: adjustedScore,
    violations: allViolations,
    strengths: modelResult.strengths ?? [],
    overall_note: modelResult.overall_note ?? '',
    voice_pack_version: pack.version,
  });
}
