import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai/generate';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getVoicePack, buildVoiceSystemPrompt } from '@/lib/content/voice-pack';

const FAST_MODEL = 'gpt-4o-mini';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { id } = await params;

  const { data: pillar, error } = await supabaseAdmin
    .from('content_angles')
    .select('title, format, audience, goal, angle, tradition_filter, tone')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });

  const pack = await getVoicePack();
  const system = buildVoiceSystemPrompt(pack, {
    role: 'You are the creative director. Strengthen content briefs so they drive precise corpus research and on-voice content.',
  });

  let completion;
  try {
    completion = await generateText({
      tier: 'light',
      openaiModel: FAST_MODEL,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Strengthen this content brief.

CURRENT BRIEF:
Title: ${pillar.title}
Format: ${pillar.format}
Audience: ${pillar.audience || pack.identity.audience || 'not specified'}
Goal: ${pillar.goal || 'not specified'}
Angle / Hook: ${pillar.angle || 'not specified'}
Source focus: ${pillar.tradition_filter || 'any'}
Tone: ${pillar.tone || 'not specified'}

INSTRUCTIONS:
- Audience: be specific about who they are, the pain they'd describe in their own words, what they've already tried, and what they're seeking.
- Goal: name the shift in understanding or behaviour the reader will have, and the one next step they'll be ready for.
- Angle: expand to 3-4 sentences. Name the cause-and-effect mechanism the piece explains, the "aha moment" it creates, and any tension or misconception it resolves. Name the kinds of sources that would back it; don't invent specific studies or quotes.

Return JSON: { "audience": "...", "goal": "...", "angle": "..." }
Return ONLY valid JSON.`,
        },
      ],
      json: true,
      maxTokens: 600,
      temperature: 0.6,
    });
  } catch (e) {
    console.error('[enhance-brief]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Enhancement failed' }, { status: 500 });
  }

  try {
    const enhanced = JSON.parse(completion.text ?? '{}');
    return NextResponse.json({
      audience: enhanced.audience ?? pillar.audience,
      goal: enhanced.goal ?? pillar.goal,
      angle: enhanced.angle ?? pillar.angle,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Enhancement failed' }, { status: 500 });
  }
}
