import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

const PROMPTS: Record<string, (args: {
  pillarTitle: string; format: string; audience: string; goal: string;
  angle: string; tone: string; sectionTitle?: string; sectionBody?: string; corpusContext: string;
}) => { system: string; user: string; maxTokens: number }> = {

  blog: ({ pillarTitle, format, audience, angle, tone, sectionTitle, sectionBody, corpusContext }) => ({
    system: `You are a content writer for Quantum Strategies, a mystical consciousness and personal transformation company. Write compelling, substantive blog posts that blend ancient wisdom with modern insight.`,
    user: `Write an 800-1200 word blog post for the section "${sectionTitle}" from the ${format} "${pillarTitle}".

Audience: ${audience}
Angle: ${angle}
Tone: ${tone}

${sectionBody ? `SECTION DRAFT TO EXPAND:\n${sectionBody}\n\n` : ''}CORPUS PASSAGES:\n${corpusContext}

Format: A punchy headline, engaging intro paragraph, 3-4 substantive body sections with subheadings, closing paragraph with insight. Cite sources as (Tradition — Text).`,
    maxTokens: 1600,
  }),

  social_twitter: ({ sectionTitle, sectionBody, pillarTitle }) => ({
    system: `You write viral Twitter/X threads about consciousness, mysticism, and transformation. Each thread is punchy, surprising, and makes people think.`,
    user: `Write a 5-7 tweet thread about "${sectionTitle}" from "${pillarTitle}".

${sectionBody ? `CONTENT:\n${sectionBody.slice(0, 1000)}\n\n` : ''}Rules:
- Tweet 1 must be a hook (bold claim, surprising fact, or powerful question)
- Max 280 characters per tweet
- Number them: 1/ 2/ 3/ etc.
- Last tweet: key insight or call to action
- No hashtags on every tweet — one set at the end max`,
    maxTokens: 600,
  }),

  social_linkedin: ({ sectionTitle, sectionBody, pillarTitle, audience, tone }) => ({
    system: `You write LinkedIn posts for Quantum Strategies that position the brand as the leading voice on consciousness, mystical traditions, and human transformation.`,
    user: `Write a LinkedIn post (300-500 words) about "${sectionTitle}" from "${pillarTitle}".

Audience: ${audience}
Tone: ${tone}

${sectionBody ? `CONTENT:\n${sectionBody.slice(0, 800)}\n\n` : ''}Format: Hook line → personal/professional framing → 3-4 insights → call to action. Professional but human. No corporate jargon.`,
    maxTokens: 700,
  }),

  social_ig: ({ sectionTitle, sectionBody, pillarTitle }) => ({
    system: `You write Instagram captions for Quantum Strategies — evocative, poetic, and thought-provoking.`,
    user: `Write an Instagram caption + hashtags for "${sectionTitle}" from "${pillarTitle}".

${sectionBody ? `CONTENT:\n${sectionBody.slice(0, 600)}\n\n` : ''}Format:
- 100-150 word caption (evocative, poetic, ends with a question or invitation)
- Line break
- 15-20 targeted hashtags (mix of large and niche consciousness/spirituality hashtags)`,
    maxTokens: 400,
  }),

  email: ({ pillarTitle, format, audience, goal, angle, corpusContext }) => ({
    system: `You write email marketing copy for Quantum Strategies — compelling, authentic, and conversion-focused.`,
    user: `Write a launch/nurture email for the ${format} "${pillarTitle}".

Audience: ${audience}
Goal: ${goal}
Angle: ${angle}

CORPUS CONTEXT:\n${corpusContext.slice(0, 1200)}

Format:
SUBJECT: [compelling subject line]
PREVIEW: [40-char preview text]

[Email body — 350-500 words. Personal opening, introduce the transformation this content offers, 2-3 teaser insights from the content, clear CTA.]`,
    maxTokens: 800,
  }),

  email_sequence: ({ pillarTitle, format, audience, goal, angle }) => ({
    system: `You design email nurture sequences for Quantum Strategies that convert leads into students and students into advocates.`,
    user: `Design a 5-email nurture sequence for the ${format} "${pillarTitle}".

Audience: ${audience}
Goal: ${goal}
Angle: ${angle}

For each email provide:
EMAIL [N] — [Purpose: welcome/value/proof/offer/follow-up]
SUBJECT: ...
PREVIEW: ...
BODY: [150-200 word summary of content and key hook]

Write all 5 emails now.`,
    maxTokens: 1800,
  }),

  gpt_product: ({ pillarTitle, format, audience, angle, tone, corpusContext }) => ({
    system: `You design GPT product system prompts — the foundational instructions that make an AI tool feel deeply knowledgeable, personalized, and transformative.`,
    user: `Create a comprehensive system prompt for a GPT product based on the ${format} "${pillarTitle}".

Audience: ${audience}
Angle: ${angle}
Tone: ${tone}

KNOWLEDGE BASE CONTEXT:\n${corpusContext.slice(0, 2000)}

The system prompt should define:
1. The AI's persona and expertise
2. The specific transformation it guides users through
3. Key knowledge domains and how to apply them
4. Interaction style and tone
5. What it will and won't do
6. 3-5 example opening interactions

Write the full system prompt now (800-1200 words).`,
    maxTokens: 1600,
  }),
};

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { types, section_ids }: { types: string[]; section_ids?: string[] } = await req.json();

  if (!types?.length) {
    return NextResponse.json({ error: 'types array is required' }, { status: 400 });
  }

  const [pillarRes, sectionsRes, linksRes] = await Promise.all([
    supabaseAdmin.from('content_angles').select('*').eq('id', id).single(),
    supabaseAdmin
      .from('content_sections')
      .select('id, title, description, body, order_index')
      .eq('angle_id', id)
      .order('order_index'),
    supabaseAdmin
      .from('content_corpus_links')
      .select(`knowledge_chunks!inner(tradition, text_name, section, content)`)
      .eq('angle_id', id)
      .eq('curated', true),
  ]);

  if (pillarRes.error) return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });
  const pillar = pillarRes.data;

  const allSections = sectionsRes.data ?? [];
  const targetSections = section_ids?.length
    ? allSections.filter((s) => section_ids.includes(s.id))
    : allSections;

  const corpusContext = (linksRes.data ?? [])
    .map((l) => {
      const c = (Array.isArray(l.knowledge_chunks) ? l.knowledge_chunks[0] : l.knowledge_chunks) as { tradition: string; text_name: string; section?: string; content: string };
      return `[${c.tradition.toUpperCase()} — ${c.text_name}${c.section ? ` — ${c.section}` : ''}]\n${c.content.slice(0, 600)}`;
    })
    .join('\n\n---\n\n');

  const args = {
    pillarTitle: pillar.title,
    format: pillar.format,
    audience: pillar.audience || 'spiritual practitioners and consciousness explorers',
    goal: pillar.goal || 'guide transformation',
    angle: pillar.angle || 'synthesis of mystical traditions and modern science',
    tone: pillar.tone || 'inspirational',
    corpusContext,
  };

  const generated: Array<{
    angle_id: string;
    parent_section_id: string | null;
    piece_type: string;
    title: string;
    body: string;
    platform_meta: Record<string, unknown>;
  }> = [];

  // Section-level formats: one piece per section
  const sectionTypes = types.filter((t) => ['blog', 'social_twitter', 'social_linkedin', 'social_ig'].includes(t));
  // Pillar-level formats: one piece for the whole pillar
  const pillarTypes = types.filter((t) => ['email', 'email_sequence', 'gpt_product'].includes(t));

  for (const type of sectionTypes) {
    const promptFn = PROMPTS[type];
    if (!promptFn) continue;

    for (const section of targetSections) {
      const { system, user, maxTokens } = promptFn({
        ...args,
        sectionTitle: section.title,
        sectionBody: section.body || undefined,
      });

      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_completion_tokens: maxTokens,
        temperature: 0.7,
      });

      generated.push({
        angle_id: id,
        parent_section_id: section.id,
        piece_type: type,
        title: section.title,
        body: completion.choices[0].message.content ?? '',
        platform_meta: {},
      });
    }
  }

  for (const type of pillarTypes) {
    const promptFn = PROMPTS[type];
    if (!promptFn) continue;

    const allBody = targetSections.map((s) => `## ${s.title}\n${s.body || s.description || ''}`).join('\n\n');

    const { system, user, maxTokens } = promptFn({
      ...args,
      sectionBody: allBody,
    });

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_completion_tokens: maxTokens,
      temperature: 0.7,
    });

    generated.push({
      angle_id: id,
      parent_section_id: null,
      piece_type: type,
      title: pillar.title,
      body: completion.choices[0].message.content ?? '',
      platform_meta: {},
    });
  }

  if (generated.length === 0) {
    return NextResponse.json({ error: 'No valid types to generate' }, { status: 400 });
  }

  const { data: pieces, error } = await supabaseAdmin
    .from('content_pieces')
    .insert(generated)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pieces: pieces ?? [], count: generated.length });
}
