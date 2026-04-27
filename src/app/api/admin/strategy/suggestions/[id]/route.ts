import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['status', 'title', 'tagline', 'rationale', 'format', 'linked_product_id'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) updates[key] = body[key];

  const { data, error } = await supabaseAdmin
    .from('product_suggestions').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suggestion: data });
}

// Accept a suggestion — draft a full product_definition from it
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { action } = await req.json();

  if (action !== 'accept') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const { data: suggestion, error } = await supabaseAdmin
    .from('product_suggestions').select('*').eq('id', id).single();
  if (error || !suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Load pillar context
  const { data: pillar } = suggestion.pillar_id
    ? await supabaseAdmin.from('content_pillars').select('title, tradition_affinity').eq('id', suggestion.pillar_id).single()
    : { data: null };

  const prompt = `You are the product architect for Quantum Strategies.

Draft a complete product definition for:
Title: ${suggestion.title}
Tagline: ${suggestion.tagline ?? ''}
Format: ${suggestion.format ?? ''}
Stage: ${suggestion.funnel_stage}
Pillar: ${pillar?.title ?? 'QS Core'}
Traditions: ${(pillar?.tradition_affinity ?? []).join(', ')}
Rationale: ${suggestion.rationale ?? ''}

Return JSON:
{
  "product_slug": "kebab-case",
  "name": "Full product name",
  "description": "2-3 sentence product page description",
  "price": 0.00,
  "estimated_duration": "X minutes",
  "system_prompt": "Full GPT system prompt (300-500 words). Initiatory — creates a perceptual shift, not just information. Grounded in QS philosophy and the listed traditions.",
  "final_deliverable_prompt": "Prompt that generates the user's final output",
  "steps": [{"step": 1, "title": "...", "description": "...", "prompt": "..."}],
  "suggested_content_brief": "One-sentence angle for a blog post that drives traffic here"
}
Return ONLY valid JSON.`;

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 4000,
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content ?? '{}';
  if (completion.choices[0].finish_reason === 'length') {
    return NextResponse.json({ error: 'Response truncated — reduce prompt size or try again.' }, { status: 500 });
  }
  const draft = JSON.parse(raw);

  // Save to product_definitions (inactive draft)
  const { data: product, error: insertError } = await supabaseAdmin
    .from('product_definitions')
    .insert({
      product_slug: draft.product_slug,
      name: draft.name,
      description: draft.description,
      price: draft.price ?? 0,
      system_prompt: draft.system_prompt ?? '',
      final_deliverable_prompt: draft.final_deliverable_prompt ?? '',
      steps: draft.steps ?? [],
      total_steps: (draft.steps ?? []).length,
      estimated_duration: draft.estimated_duration,
      plg_stage: suggestion.funnel_stage,
      pillar_id: suggestion.pillar_id ?? null,
      is_active: false,
      is_purchasable: false,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Update suggestion status
  await supabaseAdmin.from('product_suggestions').update({
    status: 'created',
    linked_product_id: product.id,
  }).eq('id', id);

  return NextResponse.json({ product, draft, suggestion_id: id });
}
