import { NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';

const PLG_STAGES = ['awareness', 'interest', 'consideration', 'conversion', 'expansion'];

const QS_IDENTITY = `
Quantum Strategies (QS) is a mystical consciousness and business strategy company.
Mission: Help founders align consciousness, strategy, and systems so their business
becomes an authentic expression of who they are.
Core framework: Three Rites (Perception → Declaration → Alignment) + Quantum Business Framework.
Waveform physics and ancient mystical wisdom are applied as literal strategic tools.
Products should initiate, not just inform. Every offer creates a shift in perception.
`;

export async function POST() {
  try {
    // Load full context
    const [pillarsRes, topicsRes, anglesRes, piecesRes, productsRes] = await Promise.all([
      supabaseAdmin.from('content_pillars').select('*').order('created_at'),
      supabaseAdmin.from('content_topics').select('*'),
      supabaseAdmin.from('content_angles').select('id, title, status, topic_id, format'),
      supabaseAdmin.from('content_pieces').select('id, piece_type, status, angle_id'),
      supabaseAdmin.from('product_definitions')
        .select('id, product_slug, name, description, price, plg_stage, pillar_id, is_active')
        .eq('is_active', true),
    ]);

    const pillars  = pillarsRes.data ?? [];
    const topics   = topicsRes.data ?? [];
    const angles   = anglesRes.data ?? [];
    const pieces   = piecesRes.data ?? [];
    const products = productsRes.data ?? [];

    // Build context string
    const topicsByPillar: Record<string, typeof topics> = {};
    for (const t of topics) topicsByPillar[t.pillar_id] ??= [], topicsByPillar[t.pillar_id].push(t);

    const anglesByTopic: Record<string, typeof angles> = {};
    for (const a of angles) if (a.topic_id) anglesByTopic[a.topic_id] ??= [], anglesByTopic[a.topic_id].push(a);

    const contentMap = pillars.map((p) => {
      const pts = topicsByPillar[p.id] ?? [];
      const totalAngles = pts.reduce((n, t) => n + (anglesByTopic[t.id]?.length ?? 0), 0);
      const topicList = pts.map((t) => `    - ${t.title} (${anglesByTopic[t.id]?.length ?? 0} angles)`).join('\n');
      return `PILLAR: ${p.title}\n  Traditions: ${(p.tradition_affinity ?? []).join(', ')}\n  Topics: ${pts.length} | Angles: ${totalAngles}\n${topicList}`;
    }).join('\n\n');

    const productMap = products
      .sort((a, b) => PLG_STAGES.indexOf(a.plg_stage ?? '') - PLG_STAGES.indexOf(b.plg_stage ?? ''))
      .map((p) => `  [${(p.plg_stage ?? 'unknown').padEnd(13)}] ${p.name} — $${p.price ?? 0}${p.pillar_id ? ' [pillar linked]' : ''}`)
      .join('\n');

    const context = `${QS_IDENTITY}\n\nCONTENT MAP:\n${contentMap}\n\nPRODUCT CATALOG:\n${productMap}\n\nPLG STAGES: awareness → interest (lead magnets) → consideration ($7-97 self-serve) → conversion ($297-1997 Rites/courses) → expansion (high-ticket coaching/consulting)`;

    const prompt = `${context}

Analyze the content-to-product coverage matrix for Quantum Strategies. Return JSON:
{
  "narrative": "2-3 paragraph strategic assessment — where QS is strong, biggest PLG gaps, single highest-leverage move right now",
  "top_suggestions": [
    {
      "pillar_title": "...",
      "funnel_stage": "interest|consideration|conversion|expansion",
      "title": "Product name",
      "tagline": "One-line value prop",
      "rationale": "Why this gap matters and how it connects to content + corpus",
      "format": "whitepaper|ebook|mini-course|diagnostic|gpt-tool|workshop|consulting-offer",
      "corpus_themes": ["theme1"],
      "price_suggestion": 0,
      "quick_win": true
    }
  ],
  "content_gaps": [
    { "product_name": "...", "missing": "What content is needed to drive awareness to this product" }
  ]
}

Return exactly 5 top_suggestions ranked by PLG leverage. Return ONLY valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4000,
      temperature: 0.6,
    });

    const raw = completion.choices[0].message.content ?? '{}';
    const finishReason = completion.choices[0].finish_reason;
    if (finishReason === 'length') {
      return NextResponse.json({ error: 'Response truncated — context too large. Try again or reduce content map size.' }, { status: 500 });
    }
    const result = JSON.parse(raw);

    // Save suggestions to DB
    const pillarByTitle = Object.fromEntries(pillars.map((p) => [p.title, p.id]));
    if (result.top_suggestions?.length) {
      const rows = result.top_suggestions.map((s: Record<string, unknown>) => ({
        pillar_id: pillarByTitle[s.pillar_title as string] ?? null,
        funnel_stage: s.funnel_stage,
        title: s.title,
        tagline: s.tagline,
        rationale: s.rationale,
        format: s.format,
        corpus_themes: s.corpus_themes ?? [],
        generated_brief: s,
        status: 'pending',
      }));
      await supabaseAdmin.from('product_suggestions').insert(rows);
    }

    return NextResponse.json({ ...result, saved: result.top_suggestions?.length ?? 0 });
  } catch (err) {
    console.error('[strategy/analyze]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
