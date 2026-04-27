import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Load section + pillar + curated corpus
  const { data: section, error: secError } = await supabaseAdmin
    .from('content_sections')
    .select('*, content_angles(*)')
    .eq('id', id)
    .single();

  if (secError || !section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  const pillar = section.content_angles as Record<string, unknown>;

  const { data: links } = await supabaseAdmin
    .from('content_corpus_links')
    .select(`knowledge_chunks!inner(tradition, text_name, author, section, content)`)
    .eq('angle_id', pillar.id as string)
    .eq('curated', true);

  const corpusContext = (links ?? [])
    .map((l) => {
      const c = (Array.isArray(l.knowledge_chunks) ? l.knowledge_chunks[0] : l.knowledge_chunks) as { tradition: string; text_name: string; author?: string; section?: string; content: string };
      return `[${c.tradition.toUpperCase()} — ${c.text_name}${c.section ? ` — ${c.section}` : ''}]\n${c.content.slice(0, 800)}`;
    })
    .join('\n\n---\n\n');

  const formatInstructions: Record<string, string> = {
    ebook: 'Write 600-1000 words. Use clear prose with subheadings. Ground each major point in at least one sacred text or science passage.',
    webinar: 'Write a presenter script (600-900 words). Include speaker notes, transitions, and suggested pause points. Mark slide cue points as [SLIDE: ...].',
    ecourse: 'Write a lesson (500-800 words). Include a learning objective, main content, a reflection exercise, and a key takeaway.',
    whitepaper: 'Write 700-1000 words in a professional academic tone. Include citations from the corpus in the format (Tradition — Source).',
  };

  const instructions = formatInstructions[(pillar.format as string) ?? ''] ?? 'Write 600-900 words of clear, compelling prose.';

  const prompt = `You are writing section "${section.title}" for a ${pillar.format} titled "${pillar.title}".

Section description: ${section.description || 'No description provided'}
Audience: ${(pillar.audience as string) || 'spiritual practitioners and consciousness explorers'}
Tone: ${(pillar.tone as string) || 'inspirational'}
Angle: ${(pillar.angle as string) || 'synthesis of mystical traditions and modern science'}

${instructions}

CORPUS PASSAGES TO DRAW FROM:
${corpusContext || 'No corpus passages linked. Draw on general knowledge of mystical traditions.'}

Write the section now. Do not include a title header — just the body content.`;

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 1400,
    temperature: 0.7,
  });

  const draftBody = completion.choices[0].message.content ?? '';

  // Save to version history before overwriting
  const currentHistory = Array.isArray(section.version_history) ? section.version_history : [];
  const history = section.body
    ? [...currentHistory, { body: section.body, updated_at: new Date().toISOString() }]
    : currentHistory;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('content_sections')
    .update({ body: draftBody, version_history: history, status: 'draft' })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Advance pillar to 'draft' if still at 'outline'
  if (pillar.status === 'outline') {
    await supabaseAdmin.from('content_angles').update({ status: 'draft' }).eq('id', pillar.id as string);
  }

  return NextResponse.json({ section: updated });
}
