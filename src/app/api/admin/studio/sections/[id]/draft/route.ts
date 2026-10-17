import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getVoicePack, buildVoiceSystemPrompt } from '@/lib/content/voice-pack';
import { EVIDENCE_TIERS, evidenceTag } from '@/lib/corpus/evidence';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

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
    .select(`similarity, knowledge_chunks!inner(tradition, text_name, author, section, content)`)
    .eq('angle_id', pillar.id as string)
    .eq('curated', true)
    .in('knowledge_chunks.tier', [...EVIDENCE_TIERS]); // sources only: never market_signal/internal/contested/enemy

  const corpusContext = (links ?? [])
    .map((l) => {
      const c = (Array.isArray(l.knowledge_chunks) ? l.knowledge_chunks[0] : l.knowledge_chunks) as { tradition: string; text_name: string; author?: string; section?: string; content: string };
      return `${evidenceTag(l.similarity)} [${c.tradition.toUpperCase()} — ${c.text_name}${c.section ? ` — ${c.section}` : ''}]\n${c.content.slice(0, 800)}`;
    })
    .join('\n\n---\n\n');

  const formatInstructions: Record<string, string> = {
    ebook: 'Write 600-1000 words. Use clear prose with subheadings. Ground each major claim in a linked [evidence] passage and name its source plainly.',
    webinar: 'Write a presenter script (600-900 words). Include speaker notes, transitions, and suggested pause points. Mark slide cue points as [SLIDE: ...].',
    ecourse: 'Write a lesson (500-800 words). Include a learning objective, main content, a reflection exercise, and a key takeaway.',
    whitepaper: 'Write 700-1000 words in a precise, professional register. Cite [evidence] passages from the corpus in the format (Tradition — Source). Never cite a WEAK MATCH passage.',
  };

  const pack = await getVoicePack();
  const instructions = formatInstructions[(pillar.format as string) ?? ''] ?? 'Write 600-900 words of clear, compelling prose.';

  const prompt = `You are writing section "${section.title}" for a ${pillar.format} titled "${pillar.title}".

Section description: ${section.description || 'No description provided'}
Audience: ${(pillar.audience as string) || pack.identity.audience || 'not specified'}
Tone: ${(pillar.tone as string) || 'not specified'}
Angle: ${(pillar.angle as string) || 'not specified'}

${instructions}

CORPUS PASSAGES TO DRAW FROM (WEAK MATCH passages are resonance only and cannot support a claim):
${corpusContext || 'No corpus passages are linked. Do not invent sources, studies or quotes. Where a claim needs backing, mark it [NEEDS SOURCE].'}

Write the section now. Do not include a title header — just the body content.`;

  let draftBody: string;
  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: buildVoiceSystemPrompt(pack, { role: 'You write sections of long-form pieces.', includeCanon: true }) },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 1400,
      temperature: 0.7,
    });
    draftBody = completion.choices[0].message.content ?? '';
  } catch (err) {
    console.error('[section draft]', err);
    return NextResponse.json({ error: 'Model call failed', detail: err instanceof Error ? err.message : undefined }, { status: 500 });
  }

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
