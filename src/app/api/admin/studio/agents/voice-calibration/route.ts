import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

const FAST_MODEL = 'gpt-4o-mini';

// Forbidden phrases — checked via exact string match before model call
const FORBIDDEN_EXACT = [
  "Here's the truth",
  "here's the truth",
  "Let's be honest",
  "let's be honest",
  "The reality is",
  "the reality is",
  'game-changer',
  'game changer',
  'unlock',
  'level up',
  'level-up',
];

function detectForbiddenExact(content: string): Array<{ phrase: string; excerpt: string }> {
  return FORBIDDEN_EXACT
    .filter((phrase) => content.includes(phrase))
    .map((phrase) => {
      const idx = content.indexOf(phrase);
      const start = Math.max(0, idx - 30);
      const end = Math.min(content.length, idx + phrase.length + 40);
      return { phrase, excerpt: `...${content.slice(start, end)}...` };
    });
}

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json();
  const { content, angle_id } = body ?? {};

  if (!content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // ── Exact-match pre-check ─────────────────────────────────────────────────
  const exactViolations = detectForbiddenExact(content);

  // ── Semantic scoring via model ─────────────────────────────────────────────
  let modelResult: {
    score: number;
    violations: Array<{ type: string; excerpt: string; suggestion: string }>;
    strengths: string[];
    overall_note: string;
  };

  try {
    const completion = await openai.chat.completions.create({
      model: FAST_MODEL,
      response_format: { type: 'json_object' },
      max_completion_tokens: 800,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You are a voice calibration auditor for long-form content. Score content 0–100 against these criteria:

1. SECOND-PERSON (25 pts): Is 'you'/'your' the dominant address? Penalty for 'one', 'we', 'they' used to address the reader.
2. EXPERIENTIAL AUTHORITY (25 pts): Does authority come from lived observation, not from citing credentials, institutions, or study names?
3. SINCERITY OVER CLEVERNESS (25 pts): Does the writing value substance and directness over wordplay, metaphor stacking, or rhetorical flourish?
4. FORWARD MOMENTUM (25 pts): Does each sentence advance the argument? No throat-clearing, no summarizing what was just said.

Also check for these forbidden patterns (automatic deductions):
- Triads: three parallel comma-separated items ("X, Y, and Z") used rhetorically
- Exclamation points used for emphasis (not mid-sentence dialogue)
- "Here's the truth", "Let's be honest", "The reality is"
- "game-changer", "unlock", "level up"

Return JSON:
{
  "score": 0-100,
  "violations": [
    { "type": "second_person | experiential_authority | sincerity | momentum | triad | forbidden_phrase | exclamation", "excerpt": "the offending text (max 80 chars)", "suggestion": "how to fix it in one sentence" }
  ],
  "strengths": ["what the content does well (2-4 items)"],
  "overall_note": "one sentence calibration note for the writer"
}`,
        },
        {
          role: 'user',
          content: `Score this content:\n\n${content.slice(0, 3000)}`,
        },
      ],
    });

    modelResult = JSON.parse(completion.choices[0].message.content ?? '{}');
  } catch (err: any) {
    console.error('[voice-calibration agent]', err);
    return NextResponse.json({ error: 'Model call failed', detail: err?.message }, { status: 500 });
  }

  // ── Merge exact violations with model violations ───────────────────────────
  const exactAsViolations = exactViolations.map((v) => ({
    type: 'forbidden_phrase' as const,
    excerpt: v.excerpt,
    suggestion: `Remove "${v.phrase}" — use a direct declarative statement instead`,
  }));

  const allViolations = [...exactAsViolations, ...(modelResult.violations ?? [])];

  // Deduct 5 points per exact violation not already caught by model scoring
  const adjustedScore = Math.max(0, (modelResult.score ?? 0) - exactViolations.length * 5);

  // ── Log agent run if angle_id provided ────────────────────────────────────
  if (angle_id) {
    try {
      await supabaseAdmin
        .from('content_agent_runs')
        .insert({
          content_angle_id: angle_id,
          agent_type: 'voice_calibration',
          status: 'completed',
          input: { content_length: content.length },
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
  });
}
