import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

type Params = { params: Promise<{ id: string }> };

const QS_IDENTITY = `
Quantum Strategies (QS) is a mystical consciousness and business strategy company.
Mission: Help founders align consciousness, strategy, and systems so their business becomes an authentic expression of who they are.
Products should initiate, not just inform. Every offer creates a perceptual shift.
PLG stages: awareness (free content) → interest (lead magnets) → consideration ($7–97 self-serve) → conversion ($297–1997 Rites/courses) → expansion (high-ticket coaching).
`.trim();

export async function POST(_req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { id } = await params;

  const { data: angle, error: angleErr } = await supabaseAdmin
    .from('content_angles')
    .select('id, title, format, audience, goal, angle, tradition_filter, corpus_query, metadata')
    .eq('id', id)
    .single();

  if (angleErr || !angle) {
    return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });
  }

  const { data: links } = await supabaseAdmin
    .from('content_corpus_links')
    .select(`
      id, similarity,
      knowledge_chunks!inner(id, tradition, text_name, section, content, themes)
    `)
    .eq('angle_id', id)
    .eq('curated', true)
    .order('similarity', { ascending: false })
    .limit(8);

  if (!links || links.length === 0) {
    return NextResponse.json(
      { error: 'No curated passages found. Curate at least one passage before developing strategy.' },
      { status: 400 },
    );
  }

  const linkedPillarId = (angle.metadata as Record<string, unknown>)?.pillar_id as string | null ?? null;

  const { data: existingProducts } = linkedPillarId
    ? await supabaseAdmin
        .from('product_definitions')
        .select('name, plg_stage, price')
        .eq('pillar_id', linkedPillarId)
        .eq('is_active', true)
    : { data: [] as { name: string; plg_stage: string | null; price: number | null }[] };

  type Chunk = { tradition: string; text_name: string; section: string | null; content: string; themes: string[] };

  const passageSummaries = links.map((l, i) => {
    const chunk = l.knowledge_chunks as unknown as Chunk;
    const excerpt = chunk.content.slice(0, 350).replace(/\n/g, ' ');
    const themes = (chunk.themes ?? []).slice(0, 4).join(', ');
    return `${i + 1}. [${chunk.tradition}] ${chunk.text_name}${chunk.section ? ' · ' + chunk.section : ''}
   "${excerpt}${chunk.content.length > 350 ? '…' : ''}"${themes ? `\n   Themes: ${themes}` : ''}`;
  }).join('\n\n');

  const existingProductsText = (existingProducts ?? []).length > 0
    ? (existingProducts ?? []).map((p) => `  [${p.plg_stage ?? 'unknown'}] ${p.name} — $${p.price ?? 0}`).join('\n')
    : '  (none yet for this pillar)';

  const prompt = `${QS_IDENTITY}

You are a product strategist analyzing corpus research to identify the highest-leverage strategic content opportunity.

CONTENT BRIEF:
Title: ${angle.title}
Format: ${angle.format}
Audience: ${angle.audience ?? 'Not specified'}
Goal: ${angle.goal ?? 'Not specified'}
Angle: ${angle.angle ?? 'Not specified'}
Research query: ${angle.corpus_query ?? 'Not specified'}

CURATED RESEARCH PASSAGES (${links.length}):
${passageSummaries}

EXISTING PRODUCTS FOR THIS PILLAR:
${existingProductsText}

Based on this research, identify the highest-leverage strategic opportunity. Consider:
- What insight does this corpus synthesis reveal that is NOT already covered?
- Which PLG stage is most underserved given the existing products?
- What format best delivers this insight?

Return JSON:
{
  "funnel_stage": "awareness|interest|consideration|conversion|expansion",
  "title": "Specific asset or product name (not generic)",
  "tagline": "One-line value proposition",
  "rationale": "2-3 sentences: why this research creates a strategic opportunity, what gap it fills, how the cross-tradition synthesis supports the angle",
  "format": "ebook|whitepaper|ecourse|webinar|mini-course|diagnostic|gpt-tool",
  "corpus_themes": ["theme1", "theme2", "theme3"]
}
Return ONLY valid JSON.`;

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 600,
    temperature: 0.6,
  });

  let suggestion: {
    funnel_stage: string; title: string; tagline: string;
    rationale: string; format: string; corpus_themes: string[];
  };

  try {
    suggestion = JSON.parse(completion.choices[0].message.content ?? '{}');
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('product_suggestions')
    .insert({
      pillar_id: linkedPillarId,
      funnel_stage: suggestion.funnel_stage,
      title: suggestion.title,
      tagline: suggestion.tagline,
      rationale: suggestion.rationale,
      format: suggestion.format,
      corpus_themes: suggestion.corpus_themes ?? [],
      generated_brief: { source_angle_id: id, corpus_query: angle.corpus_query },
      status: 'pending',
    })
    .select('id, title, funnel_stage')
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({
    suggestion_id: inserted.id,
    title: inserted.title,
    funnel_stage: inserted.funnel_stage,
  });
}
