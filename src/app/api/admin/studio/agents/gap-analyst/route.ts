import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

const FAST_MODEL = 'gpt-4o-mini';

interface Section {
  title: string;
  angle: string;
}

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json();
  const { angle_id, sections } = body ?? {};

  if (!angle_id?.trim()) return NextResponse.json({ error: 'angle_id is required' }, { status: 400 });
  if (!Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json({ error: 'sections must be a non-empty array of { title, angle }' }, { status: 400 });
  }

  // ── Fetch all linked chunks for this angle ────────────────────────────────
  const { data: links } = await supabaseAdmin
    .from('content_corpus_links')
    .select(`
      curated,
      knowledge_chunks!inner(id, tradition, text_name, content, themes)
    `)
    .eq('angle_id', angle_id)
    .order('curated', { ascending: false })
    .limit(20);

  const chunks = (links ?? []).map((l: any) => l.knowledge_chunks);

  const chunkSummary = chunks.length > 0
    ? chunks.map((c: any) =>
        `ID:${c.id} | ${c.tradition} — ${c.text_name}\nThemes: ${(c.themes ?? []).join(', ')}\nExcerpt: "${c.content?.slice(0, 150).replace(/\n/g, ' ') ?? ''}..."`
      ).join('\n\n')
    : 'No corpus chunks linked to this angle yet.';

  // ── Analyze each section in parallel ─────────────────────────────────────
  const sectionAnalyses = await Promise.all(
    (sections as Section[]).map(async (section) => {
      const completion = await openai.chat.completions.create({
        model: FAST_MODEL,
        response_format: { type: 'json_object' },
        max_completion_tokens: 400,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are a content research analyst. Given a section's topic and the corpus evidence available, identify what key claims the section needs to make that are NOT supported by the available evidence.

Return JSON: { "missing": ["claim or evidence type not covered"], "suggested_queries": ["search string to find this evidence"] }
Keep missing to 2-4 items. Keep suggested_queries tight — 4-8 words each.`,
          },
          {
            role: 'user',
            content: `SECTION TITLE: ${section.title}
SECTION ANGLE: ${section.angle}

AVAILABLE CORPUS EVIDENCE:
${chunkSummary}

What key claims or evidence does this section need that isn't covered above?`,
          },
        ],
      });

      let parsed: { missing: string[]; suggested_queries: string[] } = { missing: [], suggested_queries: [] };
      try {
        parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
      } catch { /* use empty fallback */ }

      return {
        section: section.title,
        missing: parsed.missing ?? [],
        suggested_queries: parsed.suggested_queries ?? [],
      };
    })
  );

  // ── Deduplicate gaps across sections ──────────────────────────────────────
  const seen = new Set<string>();
  const deduped = sectionAnalyses.map((a) => ({
    ...a,
    missing: a.missing.filter((m) => {
      const key = m.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  }));

  const totalGaps = deduped.reduce((n, a) => n + a.missing.length, 0);

  // ── Log agent run ─────────────────────────────────────────────────────────
  let runId: string | null = null;
  try {
    const { data: run } = await supabaseAdmin
      .from('content_agent_runs')
      .insert({
        content_angle_id: angle_id,
        agent_type: 'gap_analyst',
        status: 'completed',
        input: { angle_id, section_count: sections.length },
        output: { gaps: deduped, total_gaps: totalGaps },
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    runId = run?.id ?? null;
  } catch { /* table not yet migrated */ }

  return NextResponse.json({ run_id: runId, gaps: deduped, total_gaps: totalGaps });
}
