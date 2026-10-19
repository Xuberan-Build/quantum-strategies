import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai/generate';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getVoicePack, buildVoiceSystemPrompt } from '@/lib/content/voice-pack';
import { EVIDENCE_TIERS, evidenceTag } from '@/lib/corpus/evidence';
import {
  buildVideoScriptPieces,
  isVideoDistributeType,
  type VideoPieceFailure,
} from '@/lib/content/formats/video-script-studio';

// Video scripts run generate → validate → repair; allow for the long-form round trips.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

const PROMPTS: Record<string, (args: {
  pillarTitle: string; format: string; audience: string; goal: string;
  angle: string; tone: string; sectionTitle?: string; sectionBody?: string; corpusContext: string;
}) => { system: string; user: string; maxTokens: number }> = {

  blog: ({ pillarTitle, format, audience, angle, tone, sectionTitle, sectionBody, corpusContext }) => ({
    system: `You write substantive blog posts that explain one mechanism clearly and end at one next step.`,
    user: `Write an 800-1200 word blog post for the section "${sectionTitle}" from the ${format} "${pillarTitle}".

Audience: ${audience}
Angle: ${angle}
Tone: ${tone}

${sectionBody ? `SECTION DRAFT TO EXPAND:\n${sectionBody}\n\n` : ''}CORPUS PASSAGES:\n${corpusContext}

Format: A punchy headline, engaging intro paragraph, 3-4 substantive body sections with subheadings, closing paragraph with insight. Cite [evidence] passages as (Tradition — Text); never cite a WEAK MATCH passage as support.`,
    maxTokens: 1600,
  }),

  social_twitter: ({ sectionTitle, sectionBody, pillarTitle }) => ({
    system: `You write X (Twitter) threads. The first tweet is a hook the thread pays off, and every tweet earns the next.`,
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
    system: `You write LinkedIn posts: one idea, explained through a real mechanism, for one reader.`,
    user: `Write a LinkedIn post (300-500 words) about "${sectionTitle}" from "${pillarTitle}".

Audience: ${audience}
Tone: ${tone}

${sectionBody ? `CONTENT:\n${sectionBody.slice(0, 800)}\n\n` : ''}Format: Hook line → personal/professional framing → 3-4 insights → call to action. Professional but human. No corporate jargon.`,
    maxTokens: 700,
  }),

  social_ig: ({ sectionTitle, sectionBody, pillarTitle }) => ({
    system: `You write Instagram captions: specific, sincere, and short.`,
    user: `Write an Instagram caption + hashtags for "${sectionTitle}" from "${pillarTitle}".

${sectionBody ? `CONTENT:\n${sectionBody.slice(0, 600)}\n\n` : ''}Format:
- 100-150 word caption (specific, ends with a reflective question or one clear next step)
- Line break
- 10-15 targeted hashtags relevant to the topic (mix of broad and niche)`,
    maxTokens: 400,
  }),

  email: ({ pillarTitle, format, audience, goal, angle, corpusContext }) => ({
    system: `You write emails: one reader, one idea, one call to action.`,
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

  // Full emails, sent as written. Parsed by src/lib/content/email-sequence.ts.
  email_sequence: ({ pillarTitle, format, audience, goal, angle, sectionBody }) => ({
    system: `You write email nurture sequences. Every email is written in full and sent exactly as written: no summaries, no placeholders for the body.`,
    user: `Write a 5-email nurture sequence for the ${format} "${pillarTitle}".

Audience: ${audience}
Goal: ${goal}
Angle: ${angle}

${sectionBody ? `CONTENT TO DRAW FROM:\n${sectionBody.slice(0, 3000)}\n\n` : ''}Use exactly this structure for each email, with nothing before the first marker:

=== EMAIL 1 ===
PURPOSE: welcome | value | proof | offer | follow-up
SUBJECT: the subject line
PREVIEW: preview text, under 90 characters
BODY:
The complete email, 200-350 words, as plain-text paragraphs separated by blank lines. Open personally, teach one idea from the content, and end with one call to action.

Write all 5 emails in full now.`,
    maxTokens: 4000,
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
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
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
      .select(`similarity, knowledge_chunks!inner(tradition, text_name, section, content)`)
      .eq('angle_id', id)
      .eq('curated', true)
      .in('knowledge_chunks.tier', [...EVIDENCE_TIERS]), // sources only: never market_signal/internal/contested/enemy
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
      return `${evidenceTag(l.similarity)} [${c.tradition.toUpperCase()} — ${c.text_name}${c.section ? ` — ${c.section}` : ''}]\n${c.content.slice(0, 600)}`;
    })
    .join('\n\n---\n\n');

  // Brand voice comes from the voice pack; each format's own system line is appended to it.
  const pack = await getVoicePack();
  const voiceSystem = (formatSystem: string) => buildVoiceSystemPrompt(pack, { role: formatSystem });

  const args = {
    pillarTitle: pillar.title,
    format: pillar.format,
    audience: pillar.audience || pack.identity.audience || 'not specified',
    goal: pillar.goal || 'not specified',
    angle: pillar.angle || 'not specified',
    tone: pillar.tone || 'not specified',
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
  // Video formats (angle-level, JSON + validator + one repair pass). Started now, awaited after the text formats.
  const videoTypes = types.filter(isVideoDistributeType);
  const videoJob = videoTypes.length
    ? buildVideoScriptPieces({
        angle: pillar,
        types: videoTypes,
        material: targetSections.map((s) => `## ${s.title}\n${s.body || s.description || ''}`).join('\n\n'),
        sources: corpusContext,
      })
    : Promise.resolve({ pieces: [], failures: [] as VideoPieceFailure[] });

  for (const type of sectionTypes) {
    const promptFn = PROMPTS[type];
    if (!promptFn) continue;

    for (const section of targetSections) {
      const { system, user, maxTokens } = promptFn({
        ...args,
        sectionTitle: section.title,
        sectionBody: section.body || undefined,
      });

      const completion = await generateText({
        tier: 'standard',
        messages: [
          { role: 'system', content: voiceSystem(system) },
          { role: 'user', content: user },
        ],
        maxTokens: maxTokens,
        temperature: 0.7,
      });

      generated.push({
        angle_id: id,
        parent_section_id: section.id,
        piece_type: type,
        title: section.title,
        body: completion.text ?? '',
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

    const completion = await generateText({
      tier: 'standard',
      messages: [
        { role: 'system', content: voiceSystem(system) },
        { role: 'user', content: user },
      ],
      maxTokens: maxTokens,
      temperature: 0.7,
    });

    generated.push({
      angle_id: id,
      parent_section_id: null,
      piece_type: type,
      title: pillar.title,
      body: completion.text ?? '',
      platform_meta: {},
    });
  }

  const video = await videoJob;

  if (generated.length === 0 && video.pieces.length === 0) {
    if (video.failures.length) {
      return NextResponse.json({ error: 'Video script generation failed', video_failures: video.failures }, { status: 502 });
    }
    return NextResponse.json({ error: 'No valid types to generate' }, { status: 400 });
  }

  let pieces: unknown[] = [];
  if (generated.length) {
    const { data, error } = await supabaseAdmin.from('content_pieces').insert(generated).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    pieces = data ?? [];
  }

  // Video pieces insert separately: content_pieces.piece_type's CHECK may not allow
  // 'video_script' yet (pending migration). On a CHECK violation, return the validated
  // scripts unsaved instead of losing them or the text pieces.
  let videoUnsaved: typeof video.pieces = [];
  let videoStoreError: string | undefined;
  if (video.pieces.length) {
    const { data, error } = await supabaseAdmin.from('content_pieces').insert(video.pieces).select();
    if (error) {
      videoUnsaved = video.pieces;
      videoStoreError =
        error.code === '23514'
          ? "content_pieces.piece_type does not allow 'video_script' yet; apply the pending migration. Scripts returned unsaved."
          : error.message;
    } else {
      pieces = pieces.concat(data ?? []);
    }
  }

  return NextResponse.json({
    pieces,
    count: pieces.length,
    ...(video.failures.length ? { video_failures: video.failures } : {}),
    ...(videoUnsaved.length ? { video_unsaved: videoUnsaved, video_store_error: videoStoreError } : {}),
  });
}
