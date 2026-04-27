import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';

const EMBED_MODEL = 'text-embedding-3-small';

const SYSTEM_PROMPT = `You are a scholar of mystical traditions, consciousness science, and esoteric philosophy with deep expertise across all major contemplative lineages.

You have been given source passages retrieved from a curated corpus of sacred texts and scientific papers. Your task is to answer the user's question by synthesizing insights from these passages.

Guidelines:
- Cite the tradition and source for each key claim, e.g. "(Taoism — Tao Te Ching)" or "(Science — REBUS Model)"
- Draw genuine connections across traditions when they illuminate the same truth from different angles
- Be precise and illuminating — avoid vague generalities
- If sources don't adequately address the question, say so clearly rather than speculating
- Aim for 250–450 words unless the question genuinely requires more depth`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, tradition, count = 10, threshold = 0.45 } = body as {
      query: string;
      tradition?: string;
      count?: number;
      threshold?: number;
    };

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    // 1. Embed the query with the same model used during ingestion
    const embeddingRes = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: query.trim(),
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    // 2. Vector similarity search
    const { data: vectorMatches, error: vecError } = await supabaseAdmin.rpc(
      'match_knowledge',
      {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: count,
        filter_tradition: tradition || null,
        filter_priority: null,
        filter_themes: null,
      }
    );
    if (vecError) throw new Error(`match_knowledge failed: ${vecError.message}`);

    // 3. Keyword search (hybrid — catches exact term matches vector may miss)
    const { data: kwMatches } = await supabaseAdmin.rpc('search_knowledge_keyword', {
      query_text: query.trim(),
      match_count: 4,
      filter_tradition: tradition || null,
    });

    // 4. Merge and deduplicate, preserving vector ranking
    type Chunk = NonNullable<typeof vectorMatches>[number];
    const seen = new Set<string>();
    const chunks: Chunk[] = [];
    for (const c of [...(vectorMatches ?? []), ...(kwMatches ?? [])] as Chunk[]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        chunks.push(c);
      }
    }

    if (chunks.length === 0) {
      return NextResponse.json({
        answer: 'No relevant passages found in the corpus for that query. Try lowering the similarity threshold, removing the tradition filter, or rephrasing your question.',
        sources: [],
        query,
      });
    }

    // 5. Build context block for the LLM
    const contextBlock = chunks
      .map((c, i) => {
        const loc = [c.author, c.section || c.chapter].filter(Boolean).join(' — ');
        return `[${i + 1}] ${c.tradition.toUpperCase()} | ${c.text_name}${loc ? ` | ${loc}` : ''}\n${c.content}`;
      })
      .join('\n\n---\n\n');

    // 6. Synthesize with LLM
    const llmStart = Date.now();
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `SOURCE PASSAGES:\n\n${contextBlock}\n\n---\n\nQUESTION: ${query}`,
        },
      ],
      max_completion_tokens: 800,
      temperature: 0.4,
    });
    const latencyMs = Date.now() - llmStart;

    const answer = completion.choices[0].message.content ?? '';

    // 7. Return answer + source metadata (no raw embeddings)
    const sources = chunks.map((c) => ({
      id: c.id,
      tradition: c.tradition,
      text_name: c.text_name,
      author: c.author,
      section: c.section || c.chapter || '',
      content: c.content,
      similarity: typeof c.similarity === 'number' ? Math.round(c.similarity * 1000) / 1000 : null,
      source_url: c.source_url,
      priority: c.priority,
    }));

    // 8. Log the query (fire-and-forget — don't block the response)
    const topSources = sources.slice(0, 5).map(({ tradition, text_name, section, similarity }) => ({
      tradition, text_name, section, similarity,
    }));
    supabaseAdmin.from('knowledge_query_log').insert({
      query,
      tradition_filter: tradition || null,
      threshold,
      match_count: count,
      chunks_returned: chunks.length,
      model: DEFAULT_MODEL,
      answer,
      top_sources: topSources,
      latency_ms: latencyMs,
    }).then(({ error }) => {
      if (error) console.error('[knowledge/query] log insert failed:', error.message);
    });

    return NextResponse.json({ answer, sources, query, model: DEFAULT_MODEL });
  } catch (err) {
    console.error('[knowledge/query]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
