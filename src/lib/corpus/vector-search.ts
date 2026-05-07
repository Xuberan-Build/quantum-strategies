// Shared vector search helper — used by deep-research and agent routes.
// Supabase JS client mis-serializes vector arrays in the Next.js App Router context
// (returns 200 with []) — use direct REST calls for the vector RPC.

export interface VectorHit {
  id: string;
  similarity?: number;
  rank?: number;
  tradition?: string;
  text_name?: string;
  author?: string;
  section?: string;
  chapter?: string;
  content?: string;
  themes?: string[];
  source_url?: string;
  priority?: string;
  [key: string]: unknown;
}

export async function vectorSearch(
  embedding: number[],
  threshold: number,
  count: number,
  tradition: string | null
): Promise<VectorHit[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/match_knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
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
