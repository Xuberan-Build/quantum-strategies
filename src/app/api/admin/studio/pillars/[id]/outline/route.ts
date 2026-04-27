import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Load pillar + curated corpus links
  const [pillarRes, linksRes] = await Promise.all([
    supabaseAdmin.from('content_angles').select('*').eq('id', id).single(),
    supabaseAdmin
      .from('content_corpus_links')
      .select(`id, knowledge_chunks!inner(tradition, text_name, author, section, content)`)
      .eq('angle_id', id)
      .eq('curated', true),
  ]);

  if (pillarRes.error) return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });
  const pillar = pillarRes.data;

  const links = linksRes.data ?? [];
  if (links.length === 0) {
    return NextResponse.json({ error: 'Curate at least one corpus passage before generating an outline' }, { status: 400 });
  }

  const corpusContext = links
    .map((l) => {
      const c = (Array.isArray(l.knowledge_chunks) ? l.knowledge_chunks[0] : l.knowledge_chunks) as { tradition: string; text_name: string; author?: string; section?: string; content: string };
      return `[${c.tradition.toUpperCase()} — ${c.text_name}${c.section ? ` — ${c.section}` : ''}]\n${c.content.slice(0, 600)}`;
    })
    .join('\n\n---\n\n');

  const formatDescriptions: Record<string, string> = {
    ebook: '8-12 chapters',
    webinar: '5-7 segments (intro, 3-5 content sections, closing)',
    ecourse: '5-8 modules with lesson breakdowns',
    whitepaper: '5-7 sections (executive summary, body sections, conclusion)',
  };

  const sectionCount = formatDescriptions[pillar.format] ?? '6-8 sections';

  const prompt = `You are designing the structure for a ${pillar.format} titled "${pillar.title}".

Audience: ${pillar.audience || 'spiritual practitioners and consciousness explorers'}
Goal: ${pillar.goal || 'guide the reader through transformation'}
Angle: ${pillar.angle || 'synthesis of mystical traditions and modern science'}
Tone: ${pillar.tone}

Structure: ${sectionCount}

CORPUS PASSAGES TO BUILD FROM:
${corpusContext}

Generate an outline as a JSON array of sections. Each section has:
- title: clear, evocative section title
- description: 2-3 sentences describing what this section covers and which traditions/sources it draws from

Return ONLY valid JSON: { "sections": [{ "title": "...", "description": "..." }] }`;

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 1500,
    temperature: 0.6,
    response_format: { type: 'json_object' },
  });

  let outline: { sections: { title: string; description: string }[] };
  try {
    outline = JSON.parse(completion.choices[0].message.content ?? '{}');
  } catch {
    return NextResponse.json({ error: 'Failed to parse outline from AI' }, { status: 500 });
  }

  if (!outline.sections?.length) {
    return NextResponse.json({ error: 'AI returned empty outline' }, { status: 500 });
  }

  // Delete existing sections and insert new ones
  await supabaseAdmin.from('content_sections').delete().eq('angle_id', id);

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

  await supabaseAdmin.from('content_angles').update({ status: 'outline' }).eq('id', id);

  return NextResponse.json({ sections: sections ?? [] });
}
