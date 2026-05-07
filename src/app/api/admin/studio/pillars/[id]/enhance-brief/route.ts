import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';

const FAST_MODEL = 'gpt-4o-mini';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

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

  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [{
      role: 'user',
      content: `You are a creative director for Quantum Strategies — a mystical consciousness and business transformation company. Strengthen this content brief so it drives excellent corpus research and content creation.

CURRENT BRIEF:
Title: ${pillar.title}
Format: ${pillar.format}
Audience: ${pillar.audience || 'not specified'}
Goal: ${pillar.goal || 'not specified'}
Angle / Hook: ${pillar.angle || 'not specified'}
Tradition Focus: ${pillar.tradition_filter || 'all traditions'}
Tone: ${pillar.tone}

INSTRUCTIONS:
- Audience: be specific about psychographics, pain points, current worldview, what they're seeking
- Goal: name the internal state shift the reader will have; what product or action they'll be ready for
- Angle: expand to 3-4 sentences. Name the specific mystical traditions and concepts to weave (e.g., wu wei as strategic non-force, tzimtzum as creating space for emergence, kenosis and the power of emptying). Describe the "aha moment" the content creates. Name any paradoxes or tensions the content will resolve.

Return JSON: { "audience": "...", "goal": "...", "angle": "..." }
Return ONLY valid JSON.`,
    }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 600,
    temperature: 0.6,
  });

  try {
    const enhanced = JSON.parse(completion.choices[0].message.content ?? '{}');
    return NextResponse.json({
      audience: enhanced.audience ?? pillar.audience,
      goal: enhanced.goal ?? pillar.goal,
      angle: enhanced.angle ?? pillar.angle,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Enhancement failed' }, { status: 500 });
  }
}
