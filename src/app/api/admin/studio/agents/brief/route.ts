import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getVoicePack, buildVoiceSystemPrompt } from '@/lib/content/voice-pack';
import { evidenceTag } from '@/lib/corpus/evidence';
import type { Database } from '@/types/supabase';

type Tables = Database['public']['Tables'];
type AngleRow = Pick<Tables['content_angles']['Row'], 'id' | 'title' | 'audience' | 'goal' | 'angle' | 'format' | 'topic_id'> & {
  content_topics:
    | (Pick<Tables['content_topics']['Row'], 'id' | 'title' | 'pillar_id'> & {
        content_pillars: Pick<Tables['content_pillars']['Row'], 'id' | 'title'> | null;
      })
    | null;
};
type ChunkRow = Pick<Tables['knowledge_chunks']['Row'], 'id' | 'tradition' | 'text_name' | 'author' | 'section' | 'content'>;
type LinkRow = Pick<Tables['content_corpus_links']['Row'], 'similarity' | 'curated'> & { knowledge_chunks: ChunkRow | null };

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { angle_id, additional_context } = body ?? {};
  if (typeof angle_id !== 'string' || !angle_id.trim()) {
    return NextResponse.json({ error: 'angle_id is required' }, { status: 400 });
  }

  // ── Fetch angle + topic + pillar (the title columns are `title`, not `name`) ─
  const { data: angleData, error: angleErr } = await supabaseAdmin
    .from('content_angles')
    .select(`
      id, title, audience, goal, angle, format, topic_id,
      content_topics(id, title, pillar_id,
        content_pillars(id, title)
      )
    `)
    .eq('id', angle_id)
    .maybeSingle();

  if (angleErr) {
    console.error('[brief agent] angle query failed', angleErr);
    return NextResponse.json({ error: 'Could not load angle', detail: angleErr.message }, { status: 500 });
  }
  if (!angleData) return NextResponse.json({ error: 'Angle not found' }, { status: 404 });
  const angle = angleData as unknown as AngleRow; // untyped client infers embeds as arrays; these are many-to-one (objects)

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

  const linked = ((links ?? []) as unknown as LinkRow[]).filter((l): l is LinkRow & { knowledge_chunks: ChunkRow } => !!l.knowledge_chunks);

  const topicName = angle.content_topics?.title ?? '';
  const pillarName = angle.content_topics?.content_pillars?.title ?? '';

  const chunkBlock = linked.length > 0
    ? linked.map(({ knowledge_chunks: c, similarity }, i) =>
        `[${i + 1}] ${evidenceTag(similarity)} ${c.tradition} — ${c.text_name} (${c.author ?? 'unknown'})\n${c.content?.slice(0, 300) ?? ''}`
      ).join('\n\n')
    : 'No corpus chunks linked yet. Do not invent sources; list what evidence is needed under corpus_gaps.';

  const pack = await getVoicePack();

  // ── Create agent run record ───────────────────────────────────────────────
  let runId: string | null = null;
  try {
    const { data: run } = await supabaseAdmin
      .from('content_agent_runs')
      .insert({
        content_angle_id: angle_id,
        agent_type: 'brief',
        status: 'running',
        input: { angle_id, additional_context: additional_context ?? null, voice_pack_version: pack.version },
      })
      .select('id')
      .single();
    runId = run?.id ?? null;
  } catch {
    // Table not yet migrated — continue without tracking
  }

  // ── Call model ────────────────────────────────────────────────────────────
  try {
    const system = `${buildVoiceSystemPrompt(pack, {
      role: 'You are a senior content strategist generating structured briefs for long-form pieces. The voice rules below are for the writer; reflect them in hook, thesis and voice_notes.',
    })}

OUTPUT FORMAT: Return JSON with exactly these keys:
{
  "hook": "single arresting sentence that opens the piece",
  "thesis": "1-2 sentences stating what the piece proves",
  "key_claims": ["claim 1", "claim 2", "claim 3"],
  "target_reader": "2-3 sentence description of who this is for and where they are in their thinking",
  "voice_notes": "1-2 sentence calibration note for the writer",
  "corpus_gaps": ["topic the piece needs that isn't covered by the available corpus"]
}`;

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      max_completion_tokens: 1200,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Generate a content brief for this angle.

PILLAR: ${pillarName || 'not specified'}
TOPIC: ${topicName || 'not specified'}
TITLE: ${angle.title}
AUDIENCE: ${angle.audience ?? 'not specified'}
GOAL: ${angle.goal ?? 'not specified'}
ANGLE: ${angle.angle ?? 'not specified'}
FORMAT: ${angle.format ?? 'not specified'}
${additional_context ? `\nADDITIONAL CONTEXT:\n${additional_context}` : ''}

AVAILABLE CORPUS EVIDENCE (passages tagged WEAK MATCH are resonance only and cannot support a claim):
${chunkBlock}

Generate a brief that a writer could use to produce this piece without any further guidance. The key_claims should be 3-5 distinct, defensible arguments, each one backed by an [evidence] passage above or listed as a gap. The corpus_gaps should name specific topics, frameworks, sources or evidence types that would strengthen the piece but aren't represented by [evidence] passages above.`,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    if (runId) {
      try {
        await supabaseAdmin
          .from('content_agent_runs')
          .update({ status: 'failed', output: { error: message }, completed_at: new Date().toISOString() })
          .eq('id', runId);
      } catch { /* table not yet migrated */ }
    }
    console.error('[brief agent]', err);
    return NextResponse.json({ error: 'Model call failed', detail: message }, { status: 500 });
  }
}
