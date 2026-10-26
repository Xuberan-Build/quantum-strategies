/**
 * Search Console rows -> topical map topics. Pure (client-safe): no DB, no fetch.
 *
 * Queries match on keywordKey() (the Keyword Planner match key), against, in order of strength:
 *   head_term    the topic's headTerm (the phrasing a page is titled with)
 *   search_term  the topic's Keyword Planner searchTerms
 *   query        the topic's map queries (props.top_queries plus query:<slug> nodes linked by asks_about)
 * When two topics share a phrasing, the stronger match wins, then the more specific level (subtopic over topic
 * over section over pillar, since parents roll up their children's phrasings), then the higher priority.
 *
 * Pages match through the topic's assets: `content_post:<slug>` is /articles/<slug>/ on the site.
 */
import type { TopicLevel, TopicNode } from '@/lib/brain/topical-map-types';
import { keywordKey } from './keyword-key';

export const SITE_ORIGIN = 'https://quantumstrategies.online';

export type QueryMatch = 'head_term' | 'search_term' | 'query';
export type PageMatch = 'asset' | 'content_post';

export interface TopicMatch<M extends string> {
  topicId: string;
  match: M;
}

const MATCH_RANK: Record<QueryMatch, number> = { head_term: 3, search_term: 2, query: 1 };
const LEVEL_RANK: Record<TopicLevel, number> = { subtopic: 4, topic: 3, section: 2, pillar: 1 };

/** Extra phrasing -> topic links from the graph (query nodes with an asks_about edge). */
export interface QueryEdge {
  text: string;
  topicId: string;
}

export function buildQueryTopicIndex(nodes: TopicNode[], edges: QueryEdge[] = []): Map<string, TopicMatch<QueryMatch>> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const best = new Map<string, { m: TopicMatch<QueryMatch>; score: [number, number, number] }>();
  const offer = (text: string | null | undefined, node: TopicNode | undefined, match: QueryMatch) => {
    if (!text || !node) return;
    const key = keywordKey(text);
    if (!key) return;
    const score: [number, number, number] = [MATCH_RANK[match], LEVEL_RANK[node.level] ?? 0, node.scores?.priority ?? 0];
    const cur = best.get(key);
    const better = !cur || score[0] > cur.score[0] || (score[0] === cur.score[0] && (score[1] > cur.score[1] || (score[1] === cur.score[1] && (score[2] > cur.score[2] || (score[2] === cur.score[2] && node.id < cur.m.topicId)))));
    if (better) best.set(key, { m: { topicId: node.id, match }, score });
  };
  for (const n of nodes) {
    offer(n.headTerm?.text, n, 'head_term');
    for (const t of n.searchTerms ?? []) offer(t.keyword, n, 'search_term');
    for (const q of n.queries ?? []) offer(q.text, n, 'query');
  }
  for (const e of edges) offer(e.text, byId.get(e.topicId), 'query');
  return new Map([...best].map(([k, v]) => [k, v.m]));
}

/** Article URL for a content_post slug, as Search Console reports it after normalizePage(). */
export const articleUrl = (slug: string) => `${SITE_ORIGIN}/articles/${slug.replace(/^\/+|\/+$/g, '')}/`;

export function buildPageTopicIndex(nodes: TopicNode[]): Map<string, TopicMatch<PageMatch>> {
  const out = new Map<string, { m: TopicMatch<PageMatch>; rank: number }>();
  for (const n of nodes) {
    for (const a of n.assets ?? []) {
      const [kind, ...rest] = a.ref.split(':');
      const slug = rest.join(':');
      if (kind !== 'content_post' || !slug) continue;
      const url = articleUrl(slug);
      const rank = LEVEL_RANK[n.level] ?? 0;
      const cur = out.get(url);
      if (!cur || rank > cur.rank) out.set(url, { m: { topicId: n.id, match: 'content_post' }, rank });
    }
  }
  return new Map([...out].map(([k, v]) => [k, v.m]));
}

export function topicForRow(row: { query_key: string; page: string }, queries: Map<string, TopicMatch<QueryMatch>>, pages: Map<string, TopicMatch<PageMatch>>): string | null {
  return queries.get(row.query_key)?.topicId ?? pages.get(row.page)?.topicId ?? null;
}

/** Every topic with a head term, for the "tracked head terms" view. */
export function trackedHeadTerms(nodes: TopicNode[]): { topicId: string; label: string; pillarCode: string; level: TopicLevel; headTerm: string; key: string; volume: number }[] {
  return nodes
    .filter((n) => n.headTerm?.text)
    .map((n) => ({ topicId: n.id, label: n.label, pillarCode: n.pillarCode, level: n.level, headTerm: n.headTerm!.text, key: keywordKey(n.headTerm!.text), volume: n.headTerm!.volume ?? 0 }))
    .sort((a, b) => b.volume - a.volume || a.label.localeCompare(b.label));
}
