import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { expandQuery, rerankChunks } from '@/lib/corpus/expand-query';
import { vectorSearch, type VectorHit } from '@/lib/corpus/vector-search';

const EMBED_MODEL      = 'text-embedding-3-small';
const VECTOR_THRESHOLD = 0.10;
const VECTOR_COUNT     = 12;
const KEYWORD_COUNT    = 10;
const RERANK_THRESHOLD = 5;
const MAX_CANDIDATES   = 20;

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json();
  const { angle_id, queries, tradition_filter } = body ?? {};

  if (!angle_id?.trim()) return NextResponse.json({ error: 'angle_id is required' }, { status: 400 });
  if (!Array.isArray(queries) || queries.length === 0) {
    return NextResponse.json({ error: 'queries must be a non-empty array' }, { status: 400 });
  }

  const primaryQuery = queries[0];

  // ── Fetch angle for context ───────────────────────────────────────────────
  const { data: angle } = await supabaseAdmin
    .from('content_angles')
    .select('title, audience, goal, angle, tradition_filter')
    .eq('id', angle_id)
    .single();

  const rawTradition = tradition_filter || angle?.tradition_filter || null;
  const effectiveTradition = (rawTradition && !rawTradition.includes(',')) ? rawTradition : null;

  // ── Expand first query for additional search vectors ──────────────────────
  const expansion = await expandQuery(openai, primaryQuery, angle ?? {});
  const allQueries = [...queries, ...expansion.queries].slice(0, 5);

  // ── Batch embed ───────────────────────────────────────────────────────────
  const embeddingRes = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: allQueries,
  });
  const embeddings = embeddingRes.data.map((d) => d.embedding);

  // ── Parallel retrieval ────────────────────────────────────────────────────
  const [vectorResultArrays, kwResult] = await Promise.all([
    Promise.all(embeddings.map((emb) => vectorSearch(emb, VECTOR_THRESHOLD, VECTOR_COUNT, effectiveTradition))),
    supabaseAdmin.rpc('search_knowledge_keyword', {
      query_text: primaryQuery,
      match_count: KEYWORD_COUNT,
      filter_tradition: effectiveTradition,
    }),
  ]);

  // ── Merge and deduplicate ─────────────────────────────────────────────────
  const seen = new Set<string>();
  const merged: (VectorHit & { matched_via: string[] })[] = [];

  const addHit = (hit: VectorHit, via: string) => {
    if (seen.has(hit.id)) {
      const existing = merged.find((m) => m.id === hit.id);
      if (existing && !existing.matched_via.includes(via)) existing.matched_via.push(via);
      return;
    }
    seen.add(hit.id);
    merged.push({ ...hit, matched_via: [via] });
  };

  for (let qi = 0; qi < vectorResultArrays.length; qi++) {
    const label = qi === 0
      ? `vector:${allQueries[0].slice(0, 30)}`
      : `vector:${allQueries[qi]?.slice(0, 30) ?? `q${qi}`}`;
    for (const hit of vectorResultArrays[qi]) addHit(hit, label);
  }
  for (const hit of (kwResult.data ?? []) as VectorHit[]) addHit(hit, 'keyword');

  merged.sort((a, b) => ((b.similarity as number) ?? 0) - ((a.similarity as number) ?? 0));
  const candidates = merged.slice(0, MAX_CANDIDATES);

  // ── Re-rank ───────────────────────────────────────────────────────────────
  type RelevanceEntry = { score: number; reason: string; matched_via: string[] };
  const relevanceMap: Record<string, RelevanceEntry> = {};

  if (candidates.length >= RERANK_THRESHOLD) {
    const ranked = await rerankChunks(
      openai,
      angle ?? {},
      candidates.map((c) => ({
        id: c.id,
        tradition: (c.tradition as string) ?? '',
        text_name: (c.text_name as string) ?? '',
        content: (c.content as string) ?? '',
      })),
      primaryQuery
    );
    for (const r of ranked) {
      const candidate = candidates.find((c) => c.id === r.chunk_id);
      relevanceMap[r.chunk_id] = { score: r.score, reason: r.reason, matched_via: candidate?.matched_via ?? [] };
    }
  } else {
    for (const c of candidates) {
      relevanceMap[c.id] = {
        score: Math.round(((c.similarity as number) ?? 0.5) * 10),
        reason: '',
        matched_via: c.matched_via,
      };
    }
  }

  const finalCandidates = candidates.filter(
    (c) => !relevanceMap[c.id] || (relevanceMap[c.id]?.score ?? 0) >= 5
  );

  // ── Log agent run ─────────────────────────────────────────────────────────
  let runId: string | null = null;
  try {
    const { data: run } = await supabaseAdmin
      .from('content_agent_runs')
      .insert({
        content_angle_id: angle_id,
        agent_type: 'corpus_researcher',
        status: 'completed',
        input: { queries, tradition_filter: tradition_filter ?? null },
        output: { count: finalCandidates.length, expansion_queries: allQueries },
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    runId = run?.id ?? null;
  } catch { /* table not yet migrated */ }

  return NextResponse.json({
    run_id: runId,
    chunks: finalCandidates,
    relevance: relevanceMap,
    expansion_queries: allQueries,
    count: finalCandidates.length,
  });
}
