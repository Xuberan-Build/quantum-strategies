import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json();
  const { angle_id, additional_context } = body ?? {};
  if (!angle_id?.trim()) {
    return NextResponse.json({ error: 'angle_id is required' }, { status: 400 });
  }

  // ── Fetch angle + topic + pillar ─────────────────────────────────────────
  const { data: angle, error: angleErr } = await supabaseAdmin
    .from('content_angles')
    .select(`
      id, title, audience, goal, angle, format, topic_id,
      content_topics(id, name, pillar_id,
        content_pillars(id, name)
      )
    `)
    .eq('id', angle_id)
    .single();

  if (angleErr || !angle) {
    return NextResponse.json({ error: 'Angle not found' }, { status: 404 });
  }

  // ── Fetch linked corpus chunks (curated first, then by similarity, top 8) ─
  const { data: links } = await supabaseAdmin
    .from('content_corpus_links')
    .select(`
      similarity, curated,
      knowledge_chunks!inner(id, tradition, text_name, author, section, content)
    `)
    .eq('angle_id', angle_id)
    .order('curated', { ascending: false })
    .order('similarity', { ascending: false })
    .limit(8);

  const chunks = (links ?? []).map((l: any) => l.knowledge_chunks);

  const topicName = (angle as any).content_topics?.name ?? '';
  const pillarName = (angle as any).content_topics?.content_pillars?.name ?? '';

  const chunkBlock = chunks.length > 0
    ? chunks.map((c: any, i: number) =>
        `[${i + 1}] ${c.tradition} — ${c.text_name} (${c.author ?? 'unknown'})\n${c.content?.slice(0, 300) ?? ''}`
      ).join('\n\n')
    : 'No corpus chunks linked yet.';

  // ── Create agent run record ───────────────────────────────────────────────
  let runId: string | null = null;
  try {
    const { data: run } = await supabaseAdmin
      .from('content_agent_runs')
      .insert({
        content_angle_id: angle_id,
        agent_type: 'brief',
        status: 'running',
        input: { angle_id, additional_context: additional_context ?? null },
      })
      .select('id')
      .single();
    runId = run?.id ?? null;
  } catch {
    // Table not yet migrated — continue without tracking
  }

  // ── Call model ────────────────────────────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      max_completion_tokens: 1200,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `You are a senior content strategist generating structured briefs for long-form articles.

VOICE RULES (non-negotiable):
- Second-person ('you'/'your') throughout — never 'one', rarely 'we'
- Authority from lived experience, not credentials or citations
- Sincerity over cleverness — substance beats wordplay
- Forward momentum — every sentence earns the next
- No triads. No 'Here's the truth', 'Let's be honest', 'The reality is'. No exclamation points as habit.

OUTPUT FORMAT: Return JSON with exactly these keys:
{
  "hook": "single arresting sentence that opens the piece",
  "thesis": "1-2 sentences stating what the piece proves",
  "key_claims": ["claim 1", "claim 2", "claim 3"],
  "target_reader": "2-3 sentence description of who this is for and where they are in their thinking",
  "voice_notes": "1-2 sentence calibration note for the writer",
  "corpus_gaps": ["topic the piece needs that isn't covered by the available corpus"]
}`,
        },
        {
          role: 'user',
          content: `Generate a content brief for this angle.

PILLAR: ${pillarName}
TOPIC: ${topicName}
TITLE: ${angle.title}
AUDIENCE: ${angle.audience ?? 'not specified'}
GOAL: ${angle.goal ?? 'not specified'}
ANGLE: ${angle.angle ?? 'not specified'}
FORMAT: ${angle.format ?? 'not specified'}
${additional_context ? `\nADDITIONAL CONTEXT:\n${additional_context}` : ''}

AVAILABLE CORPUS EVIDENCE:
${chunkBlock}

Generate a brief that a writer could use to produce this piece without any further guidance. The key_claims should be 3-5 distinct, defensible arguments. The corpus_gaps should name specific topics, frameworks, or evidence types that would strengthen the piece but aren't represented in the corpus above.`,
        },
      ],
    });

    const raw = completion.choices[0].message.content ?? '{}';
    let brief: Record<string, unknown>;
    try {
      brief = JSON.parse(raw);
    } catch {
      brief = { hook: raw, thesis: '', key_claims: [], target_reader: '', voice_notes: '', corpus_gaps: [] };
    }

    // ── Update run record ─────────────────────────────────────────────────
    if (runId) {
      try {
        await supabaseAdmin
          .from('content_agent_runs')
          .update({ status: 'completed', output: brief, completed_at: new Date().toISOString() })
          .eq('id', runId);
      } catch { /* table not yet migrated */ }
    }

    return NextResponse.json({ run_id: runId, brief });
  } catch (err: any) {
    if (runId) {
      try {
        await supabaseAdmin
          .from('content_agent_runs')
          .update({ status: 'failed', output: { error: err?.message ?? 'unknown' }, completed_at: new Date().toISOString() })
          .eq('id', runId);
      } catch { /* table not yet migrated */ }
    }
    console.error('[brief agent]', err);
    return NextResponse.json({ error: 'Model call failed', detail: err?.message }, { status: 500 });
  }
}
