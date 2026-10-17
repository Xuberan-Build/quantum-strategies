// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { corpusSourceNodes, cosine, evidenceEdges, isSelf, scorePool, sourceKey, type Hit } from '../corpus';
import { gapHeadline, gapsMarkdown, proposeIngestion, proposalsMarkdown, type GapRow } from '../gaps';
import { docId, isValidId, nodeId, noteId, shortHash, slugify } from '../ids';
import { clean, extractLinks, firstParagraph, sections, tables } from '../md';
import { Graph } from '../types';

describe('id and slug rules', () => {
  it('ids are <type>:<slug>, lowercase, safe', () => {
    expect(nodeId('problem', 'Self Worth!')).toBe('problem:self-worth');
    expect(nodeId('sub_pillar', 'P1.1')).toBe('sub_pillar:p1-1');
    expect(nodeId('cornerstone', 'P1.1a-CS')).toBe('cornerstone:p1-1a-cs');
    expect(isValidId('problem:self-worth')).toBe(true);
    expect(isValidId('Problem:x')).toBe(false);
    expect(isValidId('problem:')).toBe(false);
  });
  it('notes and docs use the admin doc slug', () => {
    expect(noteId('gtm/problem-solution-map.md')).toBe('note:gtm--problem-solution-map');
    expect(docId('research/language/Audience Vocab.md')).toBe('doc:research--language--audience-vocab');
    expect(noteId('00-north-star.md')).toBe('note:00-north-star');
  });
  it('slugify and short hashes are stable', () => {
    expect(slugify('Anchored → Ascended & more')).toBe('anchored-to-ascended-and-more');
    expect(slugify('Ünïcödé')).toBe('unicode');
    expect(slugify('')).toBe('x');
    expect(shortHash('a', 'b')).toBe(shortHash('a', 'b'));
    expect(shortHash('a', 'b')).not.toBe(shortHash('ab'));
    expect(shortHash('x')).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('markdown helpers', () => {
  it('clean keeps snake_case codes but strips emphasis', () => {
    expect(clean('**NOT_CAUGHT_UP** and _emph_ [link](x.md) `code`')).toBe('NOT_CAUGHT_UP and emph link code');
  });
  it('tables, sections, links, first paragraph', () => {
    const md = '# T\n\n## A\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n### A1\ntext\n\n## B\nsee [[x]] and [y](../y.md) and `gtm/z.md`';
    expect(tables(md)[0]).toMatchObject({ header: ['a', 'b'], rows: [['1', '2']], heading: 'A' });
    expect(sections(md, 2).map((s) => s.title)).toEqual(['A', 'B']);
    expect(sections(md, 3)[0].body).toBe('text');
    expect(extractLinks(md).map((l) => `${l.kind}:${l.target}`)).toEqual(['wikilink:x', 'markdown:../y.md', 'path:gtm/z.md']);
    expect(firstParagraph('# T\n\n- a list item that is long enough\n\nA real paragraph that is long enough.')).toBe('A real paragraph that is long enough.');
  });
});

describe('graph merge', () => {
  it('merges nodes and edges across extractors', () => {
    const g = new Graph();
    g.add({ nodes: [{ id: 'problem:a', type: 'problem', label: 'From map', weight: 10, props: { x: 1 } }], edges: [] }, 'problem-map');
    g.add({ nodes: [{ id: 'problem:a', type: 'problem', label: 'default', weight: 3, props: { y: 2 } }, { id: 'quote:q', type: 'quote', label: 'q' }], edges: [{ src: 'quote:q', dst: 'problem:a', type: 'voices' }, { src: 'quote:q', dst: 'problem:a', type: 'voices', weight: 2 }, { src: 'quote:q', dst: 'quote:q', type: 'mentions' }] }, 'audience');
    const a = g.nodes.get('problem:a')!;
    expect(a.label).toBe('From map');
    expect(a.weight).toBe(10);
    expect(a.props).toMatchObject({ x: 1, y: 2, extractors: ['audience', 'problem-map'] });
    expect(g.edges.size).toBe(1);
    expect([...g.edges.values()][0]).toMatchObject({ weight: 2, props: { extractor: 'audience' } });
    g.addEdge({ src: 'quote:q', dst: 'problem:missing', type: 'voices' }, 'audience');
    expect(g.pruneDangling()).toBe(1);
  });
});

describe('corpus bridge (pure parts)', () => {
  const sources = [{ id: '11111111-1111-1111-1111-111111111111', tradition: 'psychology', text_name: 'swann', display_name: 'Swann (1983)', author: 'Swann', source_url: 'https://x', chunk_count: 2, status: 'ingested' }];
  const chunks = [
    { tradition: 'psychology', text_name: 'swann', author: 'Swann', tier: 'evidence', source_url: null },
    { tradition: 'psychology', text_name: 'swann', author: 'Swann', tier: 'evidence', source_url: null },
    { tradition: 'creator_research', text_name: 'yt_someone', author: 'Someone', tier: 'market_signal', source_url: 'https://www.youtube.com/watch?v=1' },
  ];
  const idx = corpusSourceNodes(sources, chunks);
  it('one node per source text, uuid when registered, tradition.text_name otherwise', () => {
    expect(idx.nodes.map((n) => n.id).sort()).toEqual(['corpus_source:11111111-1111-1111-1111-111111111111', 'corpus_source:creator-research-yt-someone']);
    const s = idx.nodes.find((n) => n.props?.registered)!;
    expect(s).toMatchObject({ label: 'Swann (1983)', tier: 'evidence' });
    expect(idx.nodes.find((n) => !n.props?.registered)!.url).toBeNull();
  });
  it('evidences edges: grouped by source, top 3 chunk ids, 0.45 floor, self excluded', () => {
    const hit = (id: string, sim: number, text = 'swann', tradition = 'psychology', tier = 'evidence'): Hit => ({ id, tradition, text_name: text, author: null, content: `c ${id}`, similarity: sim, tier });
    const hits = [hit('a', 0.6), hit('b', 0.55), hit('c', 0.5), hit('d', 0.47), hit('e', 0.44, 'yt_someone', 'creator_research', 'market_signal'), hit('f', 0.9, 'note', 'qs_internal', 'internal')];
    const { edges, best } = evidenceEdges('claim:p1', hits, idx.idByKey, 'evidence');
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ src: 'corpus_source:11111111-1111-1111-1111-111111111111', dst: 'claim:p1', type: 'evidences', props: { similarity: 0.6, chunk_ids: ['a', 'b', 'c'], kind: 'evidence' } });
    expect(best).toMatchObject({ similarity: 0.6, chunk: 'a' });
    expect(evidenceEdges('claim:p1', [hit('x', 0.44)], idx.idByKey, 'evidence').edges).toHaveLength(0);
    expect(evidenceEdges('claim:p1', [hit('x', 0.44)], idx.idByKey, 'evidence').best?.similarity).toBe(0.44);
    expect(isSelf({ tradition: 'psychology', tier: 'evidence', metadata: { origin: 'second_brain' } })).toBe(true);
    expect(sourceKey('a', 'b')).not.toBe(sourceKey('ab', ''));
  });
});

describe('exact scoring pool', () => {
  it('cosine + scorePool rank chunks above the threshold', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    const row = (id: string, v: number[]) => ({ id, tradition: 't', text_name: 'n', author: null, content: id, tier: 'evidence', metadata: null, source_url: null, vec: Float32Array.from(v), norm: Math.hypot(...v) });
    const pool = { tiers: ['evidence'], rows: [row('far', [0, 1]), row('near', [1, 0.1]), row('mid', [1, 1])] };
    expect(scorePool(pool, [1, 0], 0.25).map((h) => h.id)).toEqual(['near', 'mid']);
  });
});

describe('gap report', () => {
  const rows: GapRow[] = [
    { kind: 'claim_weak_evidence', node_id: 'claim:p7', label: 'Price is a signal', detail: { tier: 'E2', best_below_floor: 0.41, evidence_edges: 0 } },
    { kind: 'claim_weak_evidence', node_id: 'claim:d3', label: 'It holds', detail: { tier: 'M', best_below_floor: 0.3, evidence_edges: 0 } },
    { kind: 'problem_no_content', node_id: 'problem:x', label: 'X', detail: { merged_n: 9 } },
    { kind: 'pillar_no_demand', node_id: 'pillar:p7', label: 'Builder', detail: { problems: 0 } },
  ];
  it('headline and markdown', () => {
    expect(gapHeadline(rows)).toBe('2 claims and 0 mechanisms below the evidence floor · 0 problems with no product · 1 with no content · 1 pillars with no demand');
    const md = gapsMarkdown(rows, '2026-10-17T10:00:00Z', '2026-10-17T11:00:00Z');
    expect(md).toContain('| `claim:d3` It holds | M | 0.300 | 0 |');
    expect(md.indexOf('claim:d3')).toBeLessThan(md.indexOf('claim:p7'));
    expect(md).toContain('## Problems with no product (0)');
  });
  it('proposes queue rows only for staged cards not yet ingested', () => {
    const cards = [
      { card_key: 'price_cue', text_name: 'price', tradition: 'psychology', source_url: 'https://doi.org/x', citation: 'Rao 1989', claims: ['P7'], tier: 'evidence', ingested: false },
      { card_key: 'core_t', text_name: 'core', tradition: 'psychology', source_url: null, citation: null, claims: [], tier: 'model', ingested: true },
    ];
    const p = proposeIngestion(rows, new Map([['claim:d3', ['core_t']]]), cards);
    expect(p.proposals).toHaveLength(1);
    expect(p.proposals[0]).toMatchObject({ claim: 'claim:p7', source_type: 'url', source_url: 'https://doi.org/x', source_filename: 'corpus-staging/evidence.jsonl#price_cue' });
    expect(p.research).toEqual([expect.objectContaining({ claim: 'claim:d3' })]);
    expect(proposalsMarkdown(p, '2026-10-17T11:00:00Z')).toContain('Nothing here has been inserted');
  });
});
