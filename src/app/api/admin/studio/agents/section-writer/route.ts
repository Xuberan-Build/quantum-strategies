import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getVoicePack, buildVoiceSystemPrompt } from '@/lib/content/voice-pack';
import { EVIDENCE_TIERS, evidenceTag } from '@/lib/corpus/evidence';
import type { Database } from '@/types/supabase';

type ChunkRow = Pick<Database['public']['Tables']['knowledge_chunks']['Row'], 'id' | 'tradition' | 'text_name' | 'author' | 'content'>;

const WRITER_ROLE = `You write long-form content sections. Write prose, not bullet points, unless the section is explicitly a list. Use corpus passages as evidence to synthesise. When a claim rests on a passage, name its source plainly in the sentence; never cite a passage tagged WEAK MATCH as support.`;

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { angle_id, section_title, section_angle, chunk_ids, existing_content, mode = 'write' } = body ?? {};

  if (!angle_id?.trim()) return NextResponse.json({ error: 'angle_id is required' }, { status: 400 });
  if (!section_title?.trim()) return NextResponse.json({ error: 'section_title is required' }, { status: 400 });
  if (!section_angle?.trim()) return NextResponse.json({ error: 'section_angle is required' }, { status: 400 });
  if (!Array.isArray(chunk_ids)) return NextResponse.json({ error: 'chunk_ids must be an array' }, { status: 400 });

  // ── Fetch corpus chunks ───────────────────────────────────────────────────
  let chunks: ChunkRow[] = [];
  const similarityByChunk = new Map<string, number | null>();
  if (chunk_ids.length > 0) {
    const ids = (chunk_ids as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 6);
    const [{ data }, { data: linkRows }] = await Promise.all([
      supabaseAdmin.from('knowledge_chunks').select('id, tradition, text_name, author, content').in('id', ids).in('tier', [...EVIDENCE_TIERS]), // sources only
      supabaseAdmin.from('content_corpus_links').select('chunk_id, similarity').eq('angle_id', angle_id).in('chunk_id', ids),
    ]);
    chunks = (data ?? []) as ChunkRow[];
    for (const row of (linkRows ?? []) as { chunk_id: string; similarity: number | null }[]) {
      similarityByChunk.set(row.chunk_id, row.similarity);
    }
  }

  const corpusBlock = chunks.length > 0
    ? chunks.map((c) =>
        `SOURCE ${evidenceTag(similarityByChunk.get(c.id))}: ${c.tradition} — ${c.text_name} (${c.author ?? 'unknown'})\n"${c.content?.slice(0, 400) ?? ''}"`
      ).join('\n\n')
    : 'No corpus passages provided for this section. Do not invent sources or citations; every factual claim you make must be listed under UNSUPPORTED_CLAIMS.';

  const pack = await getVoicePack();

  // ── Create agent run ──────────────────────────────────────────────────────
  let runId: string | null = null;
  try {
    const { data: run } = await supabaseAdmin
      .from('content_agent_runs')
      .insert({
        content_angle_id: angle_id,
        agent_type: 'section_writer',
        status: 'running',
        input: { angle_id, section_title, section_angle, chunk_ids, mode, voice_pack_version: pack.version },
      })
      .select('id')
      .single();
    runId = run?.id ?? null;
  } catch { /* table not yet migrated */ }

  // ── Write or improve ──────────────────────────────────────────────────────
  try {
    let userMessage: string;

    if (mode === 'improve' && existing_content) {
      userMessage = `SECTION TITLE: ${section_title}
SECTION ANGLE: ${section_angle}

CURRENT CONTENT:
${existing_content}

CORPUS EVIDENCE FOR THIS SECTION:
${corpusBlock}

Review the current content against the voice rules and corpus evidence. Improve it by:
1. Strengthening any claims that the corpus now supports with specific synthesis
2. Cutting any sentences that are decorative rather than advancing the argument
3. Fixing any voice violations (third person, citations stacked to impress, rhetorical triads, banned phrases)
4. Ensuring the section closes by pointing toward what comes next

Return the improved full section prose. After the prose, on a new line output:
UNSUPPORTED_CLAIMS: [comma-separated list of claims in the content that have no corpus backing]`;
    } else {
      userMessage = `SECTION TITLE: ${section_title}
SECTION ANGLE: ${section_angle}

CORPUS EVIDENCE FOR THIS SECTION:
${corpusBlock}

Write this section. The section should:
- Open with a sentence that connects to what the reader just read (assume they arrived here from the prior section)
- Build the section angle using the corpus as synthesized evidence; quote only briefly, with the source named
- Close with a sentence that points toward what comes next without summarizing

Return the full section prose. After the prose, on a new line output:
UNSUPPORTED_CLAIMS: [comma-separated list of claims you made that the corpus above doesn't support — be honest]`;
    }

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: 1500,
      temperature: 0.5,
      messages: [
        { role: 'system', content: buildVoiceSystemPrompt(pack, { role: WRITER_ROLE, includeCanon: true }) },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0].message.content ?? '';

    // Parse out unsupported claims from the trailing marker
    const claimsMarker = raw.indexOf('\nUNSUPPORTED_CLAIMS:');
    let content = raw;
    let unsupported_claims: string[] = [];

    if (claimsMarker !== -1) {
      content = raw.slice(0, claimsMarker).trim();
      const claimsRaw = raw.slice(claimsMarker + '\nUNSUPPORTED_CLAIMS:'.length).trim();
      unsupported_claims = claimsRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== 'none' && s !== 'None');
    }

    const word_count = content.split(/\s+/).filter(Boolean).length;

    if (runId) {
      try {
        await supabaseAdmin
          .from('content_agent_runs')
          .update({
            status: 'completed',
            output: { content, mode, unsupported_claims, word_count },
            completed_at: new Date().toISOString(),
          })
          .eq('id', runId);
      } catch { /* table not yet migrated */ }
    }

    return NextResponse.json({ run_id: runId, content, mode, unsupported_claims, word_count });
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
    console.error('[section-writer agent]', err);
    return NextResponse.json({ error: 'Model call failed', detail: message }, { status: 500 });
  }
}
