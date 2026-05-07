import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { expandQuery, rerankChunks } from '@/lib/corpus/expand-query';
import { validateAdminApiRequest } from '@/lib/admin/auth';

const EMBED_MODEL      = 'text-embedding-3-small';
const VECTOR_THRESHOLD = 0.10;   // low — HNSW + re-ranker handle precision
const VECTOR_COUNT     = 12;     // per query; dedup reduces final set
const KEYWORD_COUNT    = 10;
const RERANK_THRESHOLD = 5;
const MAX_CANDIDATES   = 20;

type Params = { params: Promise<{ id: string }> };
type Hit = { id: string; similarity?: number; rank?: number; [key: string]: unknown };

// Supabase JS client mis-serializes vector arrays in the Next.js App Router context
// (returns 200 with []) — use direct REST calls for vector RPC.
async function vectorSearch(embedding: number[], threshold: number, count: number, tradition: string | null): Promise<Hit[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/match_knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: count,
      filter_tradition: tradition,
      filter_priority: null,
      filter_themes: null,
    }),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function POST(req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { id } = await params;
  const { query, tradition_filter } = await req.json();

  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const { data: pillar, error: pillarErr } = await supabaseAdmin
    .from('content_angles')
    .select('title, audience, goal, angle, tradition_filter')
    .eq('id', id)
    .single();

  if (pillarErr) return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });

  // tradition_filter may be a comma-separated list of traditions (e.g. "hermeticism,taoism,science").
  // The match_knowledge RPC accepts a single tradition string or NULL.
  // Treat multi-value filters as NULL — the re-ranker handles relevance.
  const rawTradition = tradition_filter || pillar.tradition_filter || null;
  const effectiveTradition = (rawTradition && !rawTradition.includes(',')) ? rawTradition : null;

  // ── Step 1: Expand the query (~350 tokens, gpt-4o-mini) ────────────────────
  const expansion = await expandQuery(openai, query.trim(), pillar);
  const allQueries = [query.trim(), ...expansion.queries].slice(0, 4);

  // ── Step 2: Batch-embed all queries in ONE API call ─────────────────────────
  const embeddingRes = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: allQueries,
  });
  const embeddings = embeddingRes.data.map((d) => d.embedding);

  // ── Step 3: Parallel retrieval ──────────────────────────────────────────────
  const [vectorResultArrays, kwResult, themeResult] = await Promise.all([
    Promise.all(embeddings.map((emb) => vectorSearch(emb, VECTOR_THRESHOLD, VECTOR_COUNT, effectiveTradition))),
    supabaseAdmin.rpc('search_knowledge_keyword', {
      query_text: query.trim(),
      match_count: KEYWORD_COUNT,
      filter_tradition: effectiveTradition,
    }),
    expansion.tradition_bridges.length > 0
      ? supabaseAdmin
          .from('knowledge_chunks')
          .select('id, tradition, text_name, author, section, chapter, content, themes, source_url, priority')
          .overlaps('themes', expansion.tradition_bridges)
          .limit(10)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  // ── Step 4: Merge and deduplicate ────────────────────────────────────────────
  const seen = new Set<string>();
  const merged: (Hit & { matched_via: string[] })[] = [];

  const addHit = (hit: Hit, via: string) => {
    if (seen.has(hit.id)) {
      const existing = merged.find((m) => m.id === hit.id);
      if (existing && !existing.matched_via.includes(via)) existing.matched_via.push(via);
      return;
    }
    seen.add(hit.id);
    merged.push({ ...hit, matched_via: [via] });
  };

  for (let qi = 0; qi < vectorResultArrays.length; qi++) {
    const label = qi === 0 ? 'vector:original' : `vector:${expansion.queries[qi - 1]?.slice(0, 30) ?? `q${qi}`}`;
    for (const hit of vectorResultArrays[qi]) addHit(hit, label);
  }
  for (const hit of (kwResult.data ?? []) as Hit[]) addHit(hit, 'keyword');
  for (const hit of (themeResult.data ?? []) as Hit[]) {
    addHit(hit, `theme:${(hit.themes as string[] | undefined)?.[0] ?? 'tag'}`);
  }

  merged.sort((a, b) => ((b.similarity as number) ?? 0) - ((a.similarity as number) ?? 0));
  const candidates = merged.slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) {
    const { count } = await supabaseAdmin.from('knowledge_chunks').select('id', { count: 'exact', head: true });
    const corpusTotal = count ?? 0;
    const message = corpusTotal === 0
      ? 'The corpus has not been ingested yet. Run the ingestion scripts to populate knowledge_chunks.'
      : 'No matching passages found. Try broader terms or remove tradition filter.';
    return NextResponse.json({ links: [], relevance: {}, expansion_queries: allQueries, message, corpusTotal, count: 0 });
  }

  // ── Step 5: Re-rank with lightweight LLM ────────────────────────────────────
  type RelevanceEntry = { score: number; reason: string; matched_via: string[] };
  const relevanceMap: Record<string, RelevanceEntry> = {};

  if (candidates.length >= RERANK_THRESHOLD) {
    const ranked = await rerankChunks(openai, pillar, candidates.map((c) => ({
      id: c.id as string,
      tradition: (c.tradition as string) ?? '',
      text_name: (c.text_name as string) ?? '',
      content: (c.content as string) ?? '',
    })), query.trim());
    for (const r of ranked) {
      const candidate = candidates.find((c) => c.id === r.chunk_id);
      relevanceMap[r.chunk_id] = { score: r.score, reason: r.reason, matched_via: candidate?.matched_via ?? [] };
    }
  } else {
    for (const c of candidates) {
      relevanceMap[c.id as string] = {
        score: Math.round(((c.similarity as number) ?? 0.5) * 10),
        reason: '',
        matched_via: c.matched_via,
      };
    }
  }

  const finalIds = candidates
    .filter((c) => !relevanceMap[c.id as string] || (relevanceMap[c.id as string]?.score ?? 0) >= 5)
    .map((c) => c.id as string);

  if (finalIds.length === 0) {
    return NextResponse.json({
      links: [], relevance: {}, expansion_queries: allQueries,
      message: 'No highly relevant passages found. Try different terms.',
      corpusTotal: candidates.length, count: 0,
    });
  }

  // ── Step 6: Upsert corpus links ──────────────────────────────────────────────
  const { error: upsertErr } = await supabaseAdmin
    .from('content_corpus_links')
    .upsert(
      candidates.map((c) => ({
        angle_id: id,
        chunk_id: c.id as string,
        similarity: typeof c.similarity === 'number' ? c.similarity : null,
        curated: false,
      })),
      { onConflict: 'angle_id,chunk_id', ignoreDuplicates: true }
    );

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  await supabaseAdmin
    .from('content_angles')
    .update({ corpus_query: query.trim(), status: 'research' })
    .eq('id', id);

  // ── Step 7: Return fresh links with chunk data ────────────────────────────────
  const { data: links } = await supabaseAdmin
    .from('content_corpus_links')
    .select(`
      id, similarity, curated, created_at,
      knowledge_chunks!inner(
        id, tradition, text_name, author, section, chapter,
        content, themes, source_url, priority
      )
    `)
    .eq('angle_id', id)
    .order('similarity', { ascending: false });

  return NextResponse.json({
    links: links ?? [],
    relevance: relevanceMap,
    expansion_queries: allQueries,
    count: finalIds.length,
    corpusTotal: candidates.length,
  });
}
