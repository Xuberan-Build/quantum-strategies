/* eslint-disable @typescript-eslint/no-explicit-any -- in-memory supabase fake */
import { describe, expect, it } from 'vitest';
import type { TopicNode } from '@/lib/brain/topical-map-types';
import type { TopicScorecard } from '@/lib/brain/topical-map';
import {
  buildResearchPack,
  excerptAround,
  extractKeyPhrases,
  interviewQuotes,
  matchTopics,
  RESEARCH_RULES,
  researchBlock,
  researchMeta,
  wantsResearch,
  type ResearchDeps,
  type ResearchSourceInput,
} from '../research';
import { FakeDb, uuid } from './fake-db';

// ── Fixtures ────────────────────────────────────────────────────────────────

function node(id: string, label: string, opts: Partial<TopicNode> = {}): TopicNode {
  return {
    id,
    level: 'topic',
    label,
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
    ...opts,
  };
}

function card(n: TopicNode, parts: Partial<TopicScorecard> = {}): TopicScorecard {
  return {
    topic: n,
    breadcrumb: [],
    children: [],
    queries: n.queries,
    problems: [],
    claims: [],
    evidence: [],
    assets: n.assets.map((a) => ({ kind: a.kind, ref: a.ref, status: a.status as any, label: a.label })),
    competitors: [],
    products: [],
    queue: { position: null, size: 0 },
    ...parts,
  };
}

const SELF = node('topic:p1-1a-why-you-snap-back-to-the-old-you', 'Why you snap back to the old you', {
  mapsTo: { cluster: 'cluster:p1-1a' },
  queries: [
    { text: 'back to my old self', sources: ['audience'], signal: 9 },
    { text: 'self image', sources: ['google_ac'], signal: 7 },
  ],
  assets: [
    { kind: 'content_post', ref: 'content_post:self-image-runs-your-life', status: 'LIVE', label: 'How your self-image runs your life' },
    { kind: 'content_post', ref: 'content_post:draft-piece', status: 'LIVE', label: 'Not published yet' },
    { kind: 'spoke', ref: 'spoke:p1-1a-01', status: 'TO BUILD', label: 'A spoke' },
  ],
});
const BREATH = node('topic:p4-box-breathing', 'Box breathing for stress', {
  pillarCode: 'P4',
  queries: [{ text: 'box breathing', sources: ['google_ac'], signal: 5 }],
  assets: [{ kind: 'content_post', ref: 'content_post:box-breathing', status: 'LIVE', label: 'Box breathing' }],
});
const NODES = [SELF, BREATH, node('topic:p2-money', 'Money signal and spending')];

const CLAIM_CHUNK = uuid();
const SELF_CARD = card(SELF, {
  claims: [
    {
      id: 'claim:c3',
      label: 'Self-concept shapes attention',
      tier: 'evidence',
      strength: 'strong',
      similarity: 0.6,
      via: 'maps_to',
      evidence: [{ chunkId: CLAIM_CHUNK, source: 'paper', similarity: 0.6, tier: 'evidence', content: 'x', url: null }],
    },
  ],
  problems: [
    {
      id: 'problem:snap',
      label: 'Snapping back',
      share: 0.5,
      quoteCount: 2,
      quotes: [
        { text: "I always convince myself I don't deserve more", likes: 120, source: 'youtube', url: 'https://youtube.com/x' },
        { text: 'Back to my old self every January', likes: 40, source: 'reddit', url: null },
      ],
    },
  ],
  products: [
    { id: 'product:signal-awareness', label: 'Signal Awareness', status: 'LIVE', fit: 0.8, via: 'quiz' },
    { id: 'product:orientation', label: 'Orientation', status: 'TO BUILD', fit: 0.5, via: null },
  ],
});

const deps = (cards: TopicScorecard[] = [SELF_CARD]): ResearchDeps => ({
  topics: async () => NODES,
  topic: async (id) => cards.find((c) => c.topic.id === id) ?? null,
});

const chunk = (content: string, tier: string | null, extra: Record<string, unknown> = {}) => ({
  id: uuid(),
  text_name: 'paper_a',
  author: 'Author A',
  section: 'Results',
  chapter: null,
  content,
  tier,
  source_url: 'https://example.org/a',
  ...extra,
});

function seed(db: FakeDb) {
  db.tables.knowledge_chunks = [
    { ...chunk('Self-concept shapes what people attend to. Their self image steers attention across the day.', 'evidence'), id: CLAIM_CHUNK, text_name: 'claim_paper' },
    chunk('People with a stable self image notice confirming evidence more often.', 'evidence', { text_name: 'paper_b' }),
    chunk('People with a stable self image notice confirming evidence more often.', 'model', { text_name: 'paper_c' }), // same text: deduped
    chunk('The self image is a creator talking point about manifesting.', 'market_signal'),
    chunk('The self image is the enemy of change.', 'enemy'),
    chunk('Self image with no tier recorded on this row at all.', null),
    chunk('As the old texts say, the self image is a mirror you polish every day.', 'lineage', { text_name: 'old_text' }),
  ];
}

const ARTICLE_ID = uuid();
const SOURCE: ResearchSourceInput = {
  form: 'social_twitter',
  title: 'You snap back to your old self image',
  text: 'You cannot out-perform your self image. Change the self image and the behaviour follows.',
  sourcePostId: ARTICLE_ID,
};

// ── Topic matching ──────────────────────────────────────────────────────────

describe('matchTopics', () => {
  it('matches by asset when the source article is one of the topic assets', () => {
    const m = matchTopics(NODES, { form: 'article', title: 'Breathing for stress', text: 'box breathing', articleUrl: 'https://quantumstrategies.online/articles/self-image-runs-your-life/' });
    expect(m[0].node.id).toBe(SELF.id);
    expect(m[0].matchedBy).toBe('asset');
    expect(m[0].reason).toMatch(/self-image-runs-your-life/);
  });

  it('falls back to keyword overlap with titles and queries', () => {
    const m = matchTopics(NODES, SOURCE);
    expect(m[0].node.id).toBe(SELF.id);
    expect(m[0].matchedBy).toBe('keywords');
    expect(m[0].reason).toMatch(/snap|self|image/);
    expect(matchTopics(NODES, { form: 'blog', title: 'Box breathing before a pitch', text: 'Try box breathing for stress.' })[0].node.id).toBe(BREATH.id);
  });

  it('returns nothing when no topic shares two words', () => {
    expect(matchTopics(NODES, { form: 'blog', title: 'Gardening tips', text: 'Tomatoes need sun.' })).toEqual([]);
  });
});

describe('helpers', () => {
  it('extracts 2 to 3 key phrases from the head of the source', () => {
    const p = extractKeyPhrases(SOURCE);
    expect(p.length).toBeGreaterThanOrEqual(2);
    expect(p.length).toBeLessThanOrEqual(3);
    expect(p[0]).toBe('self image');
  });

  it('cuts excerpts to 500 characters around the phrase', () => {
    const long = `${'filler words here '.repeat(60)}the attentional set decides ${'more filler text '.repeat(60)}`;
    const e = excerptAround(long, ['attentional']);
    expect(e.length).toBeLessThanOrEqual(500);
    expect(e).toContain('attentional set');
    expect(e.startsWith('…')).toBe(true);
  });

  it('reads interview quotes from piece notes', () => {
    expect(interviewQuotes('Made from x\nFrom interview 2026-10-20 [Q3]: "I wrote the old me down on a card." -> story')).toEqual([
      { date: '2026-10-20', id: 'Q3', quote: 'I wrote the old me down on a card.', confirmed: false, kind: null },
    ]);
    expect(interviewQuotes(null)).toEqual([]);
    expect(interviewQuotes('From interview 2026-11-01 [self-image-2026-11-01-3] (read back) (worked-out): "It is the filter, not the habit."')).toEqual([
      { date: '2026-11-01', id: 'self-image-2026-11-01-3', quote: 'It is the filter, not the habit.', confirmed: true, kind: 'worked-out' },
    ]);
  });

  it('wants research going up, and for long targets in any direction', () => {
    expect(wantsResearch('up', 'social_ig')).toBe(true);
    expect(wantsResearch('down', 'blog')).toBe(true);
    expect(wantsResearch('same', 'reddit_post')).toBe(true);
    expect(wantsResearch('down', 'social_twitter')).toBe(false);
    expect(wantsResearch('across', 'short')).toBe(false);
  });
});

// ── buildResearchPack ───────────────────────────────────────────────────────

describe('buildResearchPack', () => {
  it('puts claim evidence first, then tier-filtered, deduped full-text hits numbered S1..Sn', async () => {
    const db = new FakeDb();
    seed(db);
    const pack = await buildResearchPack(db as any, { source: SOURCE, target: 'blog' }, deps());

    expect(pack.topics[0]).toMatchObject({ id: SELF.id, matchedBy: 'keywords', pillar: 'P1' });
    expect(pack.sources.map((s) => s.id)).toEqual(pack.sources.map((_, i) => `S${i + 1}`));
    expect(pack.sources[0]).toMatchObject({ chunkId: CLAIM_CHUNK, via: 'claim', claim: 'Self-concept shapes attention' });
    expect(pack.claims).toEqual([{ id: 'claim:c3', label: 'Self-concept shapes attention', tier: 'evidence', sources: ['S1'] }]);

    const tiers = pack.sources.map((s) => s.tier);
    expect(tiers.every((t) => ['evidence', 'model', 'lineage'].includes(t))).toBe(true);
    expect(pack.sources.some((s) => /creator talking point|enemy of change|no tier recorded/.test(s.excerpt))).toBe(false);
    // the duplicate passage appears once
    expect(pack.sources.filter((s) => s.excerpt.includes('confirming evidence'))).toHaveLength(1);
    // lineage only fills when evidence and model come up short
    expect(tiers).not.toContain('lineage');
    expect(new Set(pack.sources.map((s) => s.chunkId)).size).toBe(pack.sources.length);
    for (const s of pack.sources) expect(s.excerpt.length).toBeLessThanOrEqual(500);
    expect(db.calls.some((c) => c.op === 'textSearch')).toBe(true);
  });

  it('falls back to lineage passages and says they are resonance only', async () => {
    const db = new FakeDb();
    seed(db);
    const pack = await buildResearchPack(
      db as any,
      { source: { form: 'social_twitter', title: 'Polish the mirror', text: 'The mirror you polish every day.' }, target: 'blog' },
      { topics: async () => [], topic: async () => null },
    );
    expect(pack.sources.map((s) => s.tier)).toEqual(['lineage']);
    expect(pack.gaps.some((g) => /lineage tier/.test(g))).toBe(true);
  });

  it('respects maxEvidence', async () => {
    const db = new FakeDb();
    seed(db);
    const pack = await buildResearchPack(db as any, { source: SOURCE, target: 'blog', maxEvidence: 2 }, deps());
    expect(pack.sources).toHaveLength(2);
    expect(pack.counts.sources).toBe(2);
  });

  it('carries audience queries and quotes with their sources', async () => {
    const db = new FakeDb();
    const pack = await buildResearchPack(db as any, { source: SOURCE, target: 'blog' }, deps());
    expect(pack.questions.map((q) => q.text)).toEqual(['back to my old self', 'self image']);
    expect(pack.words[0]).toMatchObject({ text: "I always convince myself I don't deserve more", kind: 'quote', url: 'https://youtube.com/x' });
    expect(pack.words[0].source).toMatch(/youtube/);
  });

  it('first-hand items are verbatim rows only, each marked with where it came from', async () => {
    const db = new FakeDb();
    const insightId = uuid();
    db.tables.content_insights = [
      { id: insightId, line: 'You cannot out-perform your self-image.', source_kind: 'article', source_ref: 'self-image-runs-your-life', source_post_id: ARTICLE_ID, pillar: 'P1', cluster: null, status: 'active' },
      { id: uuid(), line: 'I kept a card in my wallet with the old me on it.', source_kind: 'recording', source_ref: 'memo 2026-10-02 03:10', source_post_id: null, pillar: 'P1', cluster: 'cluster:p1-1a', status: 'active' },
      { id: uuid(), line: 'Archived idea.', source_kind: 'other', source_ref: null, source_post_id: ARTICLE_ID, pillar: 'P1', cluster: null, status: 'archived' },
    ];
    db.tables.content_pieces = [
      { id: uuid(), title: 'Spoke draft', source_post_id: ARTICLE_ID, notes: 'From interview 2026-10-20 [Q3]: "My first client cried when she read the list." -> story' },
    ];
    const pack = await buildResearchPack(db as any, { source: { ...SOURCE, insightId }, target: 'blog', extraContext: 'Use the wallet card story.' }, deps());

    const allRowText = [
      ...db.tables.content_insights.map((r) => r.line),
      'My first client cried when she read the list.',
      'Use the wallet card story.',
    ];
    expect(pack.firstHand.map((a) => a.id)).toEqual(pack.firstHand.map((_, i) => `A${i + 1}`));
    for (const a of pack.firstHand) expect(allRowText).toContain(a.text);
    expect(pack.firstHand.map((a) => a.text)).not.toContain('Archived idea.');
    expect(pack.firstHand[0]).toMatchObject({ text: 'You cannot out-perform your self-image.', kind: 'insight', where: 'the insight this source carries', refId: insightId });
    expect(pack.firstHand.find((a) => a.kind === 'interview_quote')!.where).toMatch(/interview 2026-10-20 \[Q3\].*Spoke draft/);
    expect(pack.firstHand.find((a) => a.text.startsWith('I kept a card'))!.where).toMatch(/pillar \(P1\), same cluster/);
    expect(pack.firstHand.find((a) => a.kind === 'extra_context')!.where).toMatch(/typed by Austin/);
    expect(pack.gaps.some((g) => /first-hand/i.test(g))).toBe(false);
  });

  it('never synthesizes first-hand material: none on file is a gap, and external pasted text is not his', async () => {
    const db = new FakeDb();
    const pack = await buildResearchPack(db as any, { source: SOURCE, target: 'blog', extraContext: 'Someone else\'s Reddit post.', extraIsSource: true }, deps());
    expect(pack.firstHand).toEqual([]);
    expect(pack.gaps.some((g) => /No first-hand material/.test(g))).toBe(true);
    expect(researchBlock(pack)).toMatch(/none on file\. Every story of his is an \[AUSTIN: <question>\]/);
  });

  it('a missing content_insights table is a gap, not a throw', async () => {
    class NoInsights extends FakeDb {
      from(name: string) {
        if (name === 'content_insights') {
          const err = { data: null, error: { message: "Could not find the table 'public.content_insights' in the schema cache" } };
          const q: any = { select: () => q, eq: () => q, limit: () => q, maybeSingle: () => q, then: (r: any) => Promise.resolve(err).then(r) };
          return q;
        }
        return super.from(name);
      }
    }
    const pack = await buildResearchPack(new NoInsights() as any, { source: { ...SOURCE, insightId: uuid() }, target: 'blog' }, deps());
    expect(pack.gaps.some((g) => /content_insights is not available/.test(g))).toBe(true);
  });

  it('links only published articles (not the source itself) and LIVE product routes', async () => {
    const db = new FakeDb();
    db.tables.content_posts = [
      { id: uuid(), slug: 'self-image-runs-your-life', title: 'How your self-image runs your life', is_published: true },
      { id: uuid(), slug: 'draft-piece', title: 'Draft', is_published: false },
    ];
    const pack = await buildResearchPack(db as any, { source: SOURCE, target: 'blog' }, deps());
    expect(pack.links).toEqual([
      { url: 'https://quantumstrategies.online/articles/self-image-runs-your-life/', label: 'How your self-image runs your life', kind: 'article', status: 'LIVE' },
      { url: 'https://quantumstrategies.online/products/perception-rite-scan-1/', label: 'Signal Awareness', kind: 'product', status: 'LIVE' },
    ]);

    const fromArticle = await buildResearchPack(
      db as any,
      { source: { ...SOURCE, form: 'article', articleUrl: 'https://quantumstrategies.online/articles/self-image-runs-your-life/' }, target: 'youtube_long' },
      deps(),
    );
    expect(fromArticle.topics[0].matchedBy).toBe('asset');
    expect(fromArticle.links.some((l) => l.url.includes('self-image-runs-your-life'))).toBe(false);
  });

  it('borrows the parent topic when the match is a bare query node', async () => {
    const parent = node('topic:p1-parent', 'Self image and identity');
    const child = node('topic:p1-q-snap-back-old-self', 'Snap back to old self image', { level: 'subtopic', parent: parent.id });
    const pack = await buildResearchPack(
      new FakeDb() as any,
      { source: SOURCE, target: 'blog' },
      { topics: async () => [child], topic: async (id) => (id === child.id ? card(child) : id === parent.id ? card(parent, { claims: SELF_CARD.claims }) : null) },
    );
    expect(pack.topics.map((t) => [t.id, t.matchedBy])).toEqual([
      [child.id, 'keywords'],
      [parent.id, 'parent'],
    ]);
    expect(pack.claims[0].id).toBe('claim:c3');
  });

  it('records gaps: no topic match, thin evidence, no first-hand', async () => {
    const pack = await buildResearchPack(new FakeDb() as any, { source: { form: 'blog', title: 'Gardening tips', text: 'Tomatoes need sun.' }, target: 'blog' }, deps());
    expect(pack.topics).toEqual([]);
    expect(pack.gaps.some((g) => /No topical-map topic matched/.test(g))).toBe(true);
    expect(pack.gaps.some((g) => /Only 0 evidence passages/.test(g))).toBe(true);
    expect(pack.gaps.some((g) => /No first-hand material/.test(g))).toBe(true);
    expect(researchBlock(pack)).toContain('TOPIC: no topical-map match.');
  });

  it('survives a topical map that cannot be read', async () => {
    const pack = await buildResearchPack(new FakeDb() as any, { source: SOURCE, target: 'blog' }, {
      topics: async () => {
        throw new Error('kg_nodes: timeout');
      },
    });
    expect(pack.gaps[0]).toMatch(/Topical map could not be read/);
  });

  it('renders the prompt block and the stored meta', async () => {
    const db = new FakeDb();
    seed(db);
    const pack = await buildResearchPack(db as any, { source: SOURCE, target: 'blog' }, deps());
    const block = researchBlock(pack);
    expect(block).toContain('RESEARCH PACK');
    expect(block).toContain('[S1] Author A, claim_paper, Results · tier: evidence · backs claim: Self-concept shapes attention');
    expect(block).toContain('AUDIENCE QUESTIONS AND WORDS:');
    expect(block).toContain('- Q (search): back to my old self');
    expect(block).toContain("AUSTIN'S MATERIAL");
    expect(block).toContain('INTERNAL LINKS:');
    expect(RESEARCH_RULES.join(' ')).toMatch(/\[NEEDS SOURCE\]/);
    const meta = researchMeta(pack) as any;
    expect(meta.topic_id).toBe(SELF.id);
    expect(meta.sources[0]).toMatchObject({ id: 'S1', chunk_id: CLAIM_CHUNK, tier: 'evidence' });
    expect(meta.counts.sources).toBe(pack.sources.length);
    expect(Array.isArray(meta.gaps)).toBe(true);
  });
});
