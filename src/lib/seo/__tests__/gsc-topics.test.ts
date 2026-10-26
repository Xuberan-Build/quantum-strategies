// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { TopicNode } from '@/lib/brain/topical-map-types';
import { buildPageTopicIndex, buildQueryTopicIndex, topicForRow, trackedHeadTerms } from '../gsc-topics';
import { buildHeadTermRows, buildKeywordRows, buildPageRows, indexSummary, totalsOf, type QueryTotal } from '../search-report';

function node(id: string, over: Partial<TopicNode> = {}): TopicNode {
  return {
    id,
    level: 'topic',
    label: id.replace('topic:', ''),
    parent: null,
    pillarCode: 'P1',
    intent: 'informational',
    summary: '',
    mapsTo: {},
    queries: [],
    scores: { demand: 0, proof: 0, coverage: 0, competition: 0, productFit: 0, priority: 50 },
    status: 'NONE',
    assets: [],
    competitors: [],
    notes: '',
    ...over,
  };
}

const nodes: TopicNode[] = [
  node('topic:p1', { level: 'pillar', searchTerms: [{ keyword: 'law of attraction', volume: 90000, yoy: null }] }),
  node('topic:loa', {
    parent: 'topic:p1',
    headTerm: { text: 'Law of Attraction', volume: 90000, audience: null, via: 'keyword_planner' },
    queries: [{ text: 'does the law of attraction work', sources: ['google_ac'], signal: 2, volume: 1300 }],
    assets: [{ kind: 'content_post', ref: 'content_post:law-of-attraction', status: 'LIVE' }],
  }),
  node('topic:manifest', { level: 'subtopic', parent: 'topic:loa', pillarCode: 'P2', queries: [{ text: 'law of attraction', sources: ['audience'], signal: 1 }, { text: 'manifesting 101', sources: ['audience'], signal: 1 }] }),
  node('topic:nlp', { headTerm: { text: 'NLP techniques', volume: 5400, audience: null, via: 'keyword_planner' } }),
];

describe('buildQueryTopicIndex', () => {
  it('prefers head term over search term over query, then the more specific level', () => {
    const idx = buildQueryTopicIndex(nodes);
    expect(idx.get('law of attraction')).toEqual({ topicId: 'topic:loa', match: 'head_term' });
    expect(idx.get('does the law of attraction work')).toEqual({ topicId: 'topic:loa', match: 'query' });
    expect(idx.get('manifesting 101')).toEqual({ topicId: 'topic:manifest', match: 'query' });
  });

  it('takes graph query edges as phrasings', () => {
    const idx = buildQueryTopicIndex(nodes, [{ text: 'NLP for anxiety', topicId: 'topic:nlp' }, { text: 'orphan', topicId: 'topic:missing' }]);
    expect(idx.get('nlp for anxiety')).toEqual({ topicId: 'topic:nlp', match: 'query' });
    expect(idx.has('orphan')).toBe(false);
  });
});

describe('page and row mapping', () => {
  it('maps content_post assets to article URLs and falls back to the page', () => {
    const p = buildPageTopicIndex(nodes);
    expect(p.get('https://quantumstrategies.online/articles/law-of-attraction/')).toEqual({ topicId: 'topic:loa', match: 'content_post' });
    const q = buildQueryTopicIndex(nodes);
    expect(topicForRow({ query_key: 'something new', page: 'https://quantumstrategies.online/articles/law-of-attraction/' }, q, p)).toBe('topic:loa');
    expect(topicForRow({ query_key: 'nlp techniques', page: '' }, q, p)).toBe('topic:nlp');
    expect(topicForRow({ query_key: 'nope', page: '' }, q, p)).toBeNull();
  });

  it('lists tracked head terms by volume', () => {
    expect(trackedHeadTerms(nodes).map((h) => h.topicId)).toEqual(['topic:loa', 'topic:nlp']);
  });
});

const qt = (query: string, clicks: number, impressions: number, position: number | null, top_page: string | null = null): QueryTotal => ({ query, query_key: query.toLowerCase(), clicks, impressions, ctr: impressions ? clicks / impressions : 0, position, top_page });

describe('search report builders', () => {
  it('joins keywords to topics, KP volume and the previous period', () => {
    const rows = buildKeywordRows(
      [qt('law of attraction', 5, 100, 12.5), qt('brand new query', 1, 10, 30, 'https://quantumstrategies.online/articles/law-of-attraction/'), qt('unmapped', 0, 4, 50)],
      [qt('law of attraction', 2, 80, 15)],
      nodes,
    );
    expect(rows[0]).toMatchObject({ topic: { id: 'topic:loa' }, match: 'head_term', volume: 90000, position: 12.5, prevPosition: 15, prevClicks: 2 });
    expect(rows[1]).toMatchObject({ topic: { id: 'topic:loa' }, match: 'content_post', volume: null, prevPosition: null });
    expect(rows[2].topic).toBeNull();
  });

  it('marks head terms not ranking yet', () => {
    const rows = buildHeadTermRows(nodes, [qt('law of attraction', 5, 100, 12)], []);
    expect(rows.find((r) => r.topic.id === 'topic:loa')).toMatchObject({ position: 12, clicks: 5, impressions: 100, prevPosition: null });
    expect(rows.find((r) => r.topic.id === 'topic:nlp')).toMatchObject({ position: null, clicks: 0 });
  });

  it('adds inspected pages without impressions and summarises index status', () => {
    const ins = [
      { url: 'https://quantumstrategies.online/', inspected_at: '2026-10-17T00:00:00Z', verdict: 'PASS', coverage_state: 'Submitted and indexed', indexing_state: null, last_crawl_time: null, google_canonical: null, user_canonical: null },
      { url: 'https://quantumstrategies.online/articles/law-of-attraction/', inspected_at: '2026-10-16T00:00:00Z', verdict: 'NEUTRAL', coverage_state: 'Crawled - currently not indexed', indexing_state: null, last_crawl_time: null, google_canonical: null, user_canonical: null },
    ];
    const pages = buildPageRows([{ page: 'https://quantumstrategies.online/', clicks: 3, impressions: 40, ctr: 0.075, position: 8 }], [], ins, nodes);
    expect(pages).toHaveLength(2);
    expect(pages[1]).toMatchObject({ impressions: 0, topic: { id: 'topic:loa' }, inspection: { verdict: 'NEUTRAL' } });
    expect(indexSummary(ins)).toMatchObject({ inspected: 2, indexed: 1, notIndexed: 1, lastInspected: '2026-10-17T00:00:00Z' });
  });

  it('weights average position by impressions', () => {
    expect(totalsOf([{ date: 'a', clicks: 1, impressions: 10, position: 2 }, { date: 'b', clicks: 1, impressions: 30, position: 10 }])).toEqual({ clicks: 2, impressions: 40, ctr: 0.05, position: 8 });
    expect(totalsOf([]).position).toBeNull();
  });
});
