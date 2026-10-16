import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getVoicePack, buildVoiceSystemPrompt } from '@/lib/content/voice-pack';
import { evidenceTag } from '@/lib/corpus/evidence';

type Params = { params: Promise<{ id: string }> };

/** How many archived outlines to keep in content_angles.metadata.outline_history. */
const OUTLINE_HISTORY_LIMIT = 10;

export async function POST(req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { id } = await params;
  const { confirm = false } = (await req.json().catch(() => ({}))) as { confirm?: boolean };

  // Load pillar + curated corpus links + existing sections
  const [pillarRes, linksRes, existingRes] = await Promise.all([
    supabaseAdmin.from('content_angles').select('*').eq('id', id).single(),
    supabaseAdmin
      .from('content_corpus_links')
      .select(`id, similarity, knowledge_chunks!inner(tradition, text_name, author, section, content)`)
      .eq('angle_id', id)
      .eq('curated', true),
    supabaseAdmin
      .from('content_sections')
      .select('id, order_index, title, description, body, version_history, status')
      .eq('angle_id', id)
      .order('order_index'),
  ]);

  if (pillarRes.error) return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });
  const pillar = pillarRes.data;
  if (existingRes.error) return NextResponse.json({ error: existingRes.error.message }, { status: 500 });
  const existing = existingRes.data ?? [];

  // Regenerating replaces the outline. Never do it silently: the client must confirm,
  // and the old sections (with their drafts) are archived on the angle first.
  if (existing.length > 0 && confirm !== true) {
    return NextResponse.json(
      {
        error: 'This angle already has an outline. Confirm to replace it; the current sections and drafts will be archived.',
        requires_confirmation: true,
        existing_count: existing.length,
        drafted_count: existing.filter((s) => s.body).length,
      },
      { status: 409 },
    );
  }

  const links = linksRes.data ?? [];
  if (links.length === 0) {
    return NextResponse.json({ error: 'Curate at least one corpus passage before generating an outline' }, { status: 400 });
  }

  const corpusContext = links
    .map((l) => {
      const c = (Array.isArray(l.knowledge_chunks) ? l.knowledge_chunks[0] : l.knowledge_chunks) as { tradition: string; text_name: string; author?: string; section?: string; content: string };
      return `${evidenceTag(l.similarity)} [${c.tradition.toUpperCase()} — ${c.text_name}${c.section ? ` — ${c.section}` : ''}]\n${c.content.slice(0, 600)}`;
    })
    .join('\n\n---\n\n');

  const formatDescriptions: Record<string, string> = {
    ebook: '8-12 chapters',
    webinar: '5-7 segments (intro, 3-5 content sections, closing)',
    ecourse: '5-8 modules with lesson breakdowns',
    whitepaper: '5-7 sections (executive summary, body sections, conclusion)',
  };

  const sectionCount = formatDescriptions[pillar.format] ?? '6-8 sections';

  const pack = await getVoicePack();
  const system = buildVoiceSystemPrompt(pack, {
    role: 'You design the structure of long-form pieces. The outline must let a writer follow the voice rules below.',
  });

  const prompt = `You are designing the structure for a ${pillar.format} titled "${pillar.title}".

Audience: ${pillar.audience || pack.identity.audience || 'not specified'}
Goal: ${pillar.goal || 'not specified'}
Angle: ${pillar.angle || 'not specified'}
Tone: ${pillar.tone || 'not specified'}

Structure: ${sectionCount}

CORPUS PASSAGES TO BUILD FROM:
${corpusContext}

Generate an outline as a JSON array of sections. Each section has:
- title: clear, evocative section title
- description: 2-3 sentences describing what this section covers and which sources it draws from. Only [evidence] passages can support a claim; WEAK MATCH passages are resonance at most.

Return ONLY valid JSON: { "sections": [{ "title": "...", "description": "..." }] }`;

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 1500,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });
  } catch (err) {
    console.error('[pillar outline]', err);
    return NextResponse.json({ error: 'Model call failed', detail: err instanceof Error ? err.message : undefined }, { status: 500 });
  }

  let outline: { sections: { title: string; description: string }[] };
  try {
    outline = JSON.parse(completion.choices[0].message.content ?? '{}');
  } catch {
    return NextResponse.json({ error: 'Failed to parse outline from AI' }, { status: 500 });
  }

  if (!outline.sections?.length) {
    return NextResponse.json({ error: 'AI returned empty outline' }, { status: 500 });
  }

  // Insert the new sections first, so a failure leaves the old outline untouched.
  const { data: sections, error: insertError } = await supabaseAdmin
    .from('content_sections')
    .insert(
      outline.sections.map((s, i) => ({
        angle_id: id,
        order_index: i,
        title: s.title,
        description: s.description,
        status: 'pending',
      }))
    )
    .select();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (existing.length > 0) {
    // Archive the old outline (titles, descriptions, drafts, history) on the angle, then remove it.
    const metadata = (pillar.metadata && typeof pillar.metadata === 'object' && !Array.isArray(pillar.metadata)
      ? pillar.metadata
      : {}) as Record<string, unknown>;
    const history = Array.isArray(metadata.outline_history) ? metadata.outline_history : [];
    const archived = {
      archived_at: new Date().toISOString(),
      archived_by: admin.id,
      sections: existing.map((section) => ({
        order_index: section.order_index,
        title: section.title,
        description: section.description,
        body: section.body,
        version_history: section.version_history,
        status: section.status,
      })),
    };
    const { error: archiveError } = await supabaseAdmin
      .from('content_angles')
      .update({ metadata: { ...metadata, outline_history: [archived, ...history].slice(0, OUTLINE_HISTORY_LIMIT) } })
      .eq('id', id);

    if (archiveError) {
      // Roll back the new sections; the old outline stays in place.
      await supabaseAdmin.from('content_sections').delete().in('id', (sections ?? []).map((s) => s.id));
      return NextResponse.json({ error: `Could not archive the current outline: ${archiveError.message}` }, { status: 500 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('content_sections')
      .delete()
      .in('id', existing.map((s) => s.id));
    if (deleteError) {
      return NextResponse.json(
        { error: `New outline saved and old one archived, but old sections could not be removed: ${deleteError.message}` },
        { status: 500 },
      );
    }
  }

  await supabaseAdmin.from('content_angles').update({ status: 'outline' }).eq('id', id);

  return NextResponse.json({ sections: sections ?? [], archived_count: existing.length });
}
