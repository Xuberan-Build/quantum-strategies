import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

const FORMAT_WORD_COUNTS: Record<string, number> = {
  blog: 1500,
  'long-form': 2500,
  'deep-dive': 3000,
  thread: 800,
  'research-review': 2000,
  'framework-explainer': 1800,
  'how-to': 1500,
  comparison: 1600,
};

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json();
  const { angle_id, word_count_target } = body ?? {};

  if (!angle_id?.trim()) return NextResponse.json({ error: 'angle_id is required' }, { status: 400 });

  // ── Fetch angle ───────────────────────────────────────────────────────────
  const { data: angle, error: angleErr } = await supabaseAdmin
    .from('content_angles')
    .select('id, title, audience, goal, angle, format')
    .eq('id', angle_id)
    .single();

  if (angleErr || !angle) {
    return NextResponse.json({ error: 'Angle not found' }, { status: 404 });
  }

  const targetWords = word_count_target
    ?? FORMAT_WORD_COUNTS[angle.format?.toLowerCase() ?? '']
    ?? 1500;

  // ── Fetch linked chunks (top 10, curated first) ───────────────────────────
  const { data: links } = await supabaseAdmin
    .from('content_corpus_links')
    .select(`
      curated,
      knowledge_chunks!inner(id, tradition, text_name, content, themes)
    `)
    .eq('angle_id', angle_id)
    .order('curated', { ascending: false })
    .order('similarity', { ascending: false })
    .limit(10);

  const chunks = (links ?? []).map((l: any) => l.knowledge_chunks);

  // ── Check for existing brief agent run ────────────────────────────────────
  let briefContext = '';
  try {
    const { data: briefRun } = await supabaseAdmin
      .from('content_agent_runs')
      .select('output')
      .eq('content_angle_id', angle_id)
      .eq('agent_type', 'brief')
      .eq('status', 'completed')
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (briefRun?.output) {
      const b = briefRun.output as Record<string, unknown>;
      briefContext = `
BRIEF (previously generated):
Hook: ${b.hook ?? ''}
Thesis: ${b.thesis ?? ''}
Key claims: ${(b.key_claims as string[] ?? []).join(' | ')}`;
    }
  } catch { /* no brief yet — that's fine */ }

  const chunkList = chunks.length > 0
    ? chunks.map((c: any, i: number) =>
        `[${i + 1}] id:${c.id} | ${c.tradition} — ${c.text_name}\nThemes: ${(c.themes ?? []).join(', ')}`
      ).join('\n\n')
    : 'No corpus chunks linked yet.';

  // ── Create agent run ──────────────────────────────────────────────────────
  let runId: string | null = null;
  try {
    const { data: run } = await supabaseAdmin
      .from('content_agent_runs')
      .insert({
        content_angle_id: angle_id,
        agent_type: 'outline',
        status: 'running',
        input: { angle_id, word_count_target: targetWords },
      })
      .select('id')
      .single();
    runId = run?.id ?? null;
  } catch { /* table not yet migrated */ }

  // ── Generate outline ──────────────────────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      max_completion_tokens: 1000,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: `You are a senior content strategist generating section outlines. Your outlines are designed for writers who will produce second-person, experience-first long-form content — not academic essays. Each section should have a clear argumentative or narrative function within the whole.

Return JSON:
{
  "sections": [
    {
      "title": "Section title",
      "angle": "One sentence: what this section argues or establishes",
      "word_count": 300,
      "chunk_ids": ["id of corpus chunk that supports this section"]
    }
  ],
  "total_word_count": 0
}

Word counts per section should sum to approximately the target. chunk_ids must reference actual IDs from the provided corpus list.`,
        },
        {
          role: 'user',
          content: `Generate a section outline for this content piece.

TITLE: ${angle.title}
FORMAT: ${angle.format ?? 'not specified'}
AUDIENCE: ${angle.audience ?? 'not specified'}
GOAL: ${angle.goal ?? 'not specified'}
ANGLE: ${angle.angle ?? 'not specified'}
TARGET WORD COUNT: ${targetWords}
${briefContext}

AVAILABLE CORPUS CHUNKS:
${chunkList}

Requirements:
- 4–7 sections (fewer for threads, more for deep-dives)
- First section establishes the problem or insight that hooks the reader
- Middle sections build the argument using corpus evidence
- Final section lands the takeaway and points forward
- Each chunk_ids entry must be a verbatim id from the list above`,
        },
      ],
    });

    const raw = completion.choices[0].message.content ?? '{}';
    let parsed: { sections: unknown[]; total_word_count: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { sections: [], total_word_count: 0 };
    }

    // Recalculate total from sections if not present
    const sections = parsed.sections ?? [];
    const totalWordCount = parsed.total_word_count
      || (sections as any[]).reduce((n: number, s: any) => n + (s.word_count ?? 0), 0);

    if (runId) {
      try {
        await supabaseAdmin
          .from('content_agent_runs')
          .update({ status: 'completed', output: { sections, total_word_count: totalWordCount }, completed_at: new Date().toISOString() })
          .eq('id', runId);
      } catch { /* table not yet migrated */ }
    }

    return NextResponse.json({ run_id: runId, sections, total_word_count: totalWordCount });
  } catch (err: any) {
    if (runId) {
      try {
        await supabaseAdmin
          .from('content_agent_runs')
          .update({ status: 'failed', output: { error: err?.message }, completed_at: new Date().toISOString() })
          .eq('id', runId);
      } catch { /* table not yet migrated */ }
    }
    console.error('[outline agent]', err);
    return NextResponse.json({ error: 'Model call failed', detail: err?.message }, { status: 500 });
  }
}
