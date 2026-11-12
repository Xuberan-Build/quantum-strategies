import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));

const generateText = vi.fn();
vi.mock('@/lib/ai/generate', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/generate')>('@/lib/ai/generate');
  return { ...actual, generateText: (...a: unknown[]) => generateText(...a), activeModelLabel: () => 'claude-test' };
});

vi.mock('@/lib/content/voice-pack', async () => {
  const actual = await vi.importActual<typeof import('@/lib/content/voice-pack')>('@/lib/content/voice-pack');
  return { ...actual, getVoicePackResult: async () => ({ pack: actual.FALLBACK_VOICE_PACK, source: 'fallback' }) };
});

const generateValidatedVideoScript = vi.fn();
vi.mock('@/lib/content/formats/video-script-generate', () => ({
  generateValidatedVideoScript: (...a: unknown[]) => generateValidatedVideoScript(...a),
}));
vi.mock('@/lib/content/formats/video-script', async () => {
  const actual = await vi.importActual<typeof import('@/lib/content/formats/video-script')>('@/lib/content/formats/video-script');
  return { ...actual, renderVideoScript: () => 'RENDERED SCRIPT — with a dash' };
});

const buildResearchPack = vi.fn();
vi.mock('../research', async () => {
  const actual = await vi.importActual<typeof import('../research')>('../research');
  return { ...actual, buildResearchPack: (...a: unknown[]) => buildResearchPack(...a) };
});

import {
  buildMakePrompt,
  DOWN_RULE,
  SAME_RULE,
  makeAsset,
  offeredTargets,
  OFFERED_TARGETS,
  stripEmDashes,
  lintMade,
  UP_RULE,
  UP_RESEARCH_RULE,
  type LoadedSource,
} from '../make';
import { RESEARCH_RULES, type ResearchPack } from '../research';
import { FORM_RANK, type PieceType } from '../types';
import { FALLBACK_VOICE_PACK } from '@/lib/content/voice-pack';

// ── Fake Supabase client ────────────────────────────────────────────────────

type Inserted = { table: string; row: Record<string, unknown> };

function fakeClient(rows: Record<string, Record<string, unknown> | null>) {
  const inserts: Inserted[] = [];
  const client = {
    from(table: string) {
      let pending: Record<string, unknown> | null = null;
      const b = {
        select: () => b,
        eq: () => b,
        insert: (row: Record<string, unknown>) => {
          pending = row;
          inserts.push({ table, row });
          return b;
        },
        single: async () => {
          if (pending) return { data: { ...pending, id: `${table}-new` }, error: null };
          const data = rows[table] ?? null;
          return data ? { data, error: null } : { data: null, error: { message: 'not found' } };
        },
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
      };
      return b;
    },
  };
  return { client: client as never, inserts };
}

const ARTICLE_ID = '11111111-1111-4111-8111-111111111111';
const PIECE_ID = '22222222-2222-4222-8222-222222222222';
const INSIGHT_ID = '33333333-3333-4333-8333-333333333333';

const ARTICLE = {
  id: ARTICLE_ID,
  slug: 'self-image',
  title: 'Self-image decides what you notice',
  excerpt: 'Your self-image picks what you notice.',
  body: 'Stare at the tree and you hit the tree. The attentional set decides what you notice.',
};

function reply(obj: unknown) {
  return { text: JSON.stringify(obj), finishReason: 'stop', usage: { prompt: 1, completion: 1, total: 2 }, provider: 'anthropic', model: 'x' };
}

const PACK: ResearchPack = {
  version: 1,
  builtAt: '2026-11-01T00:00:00.000Z',
  target: 'blog',
  topics: [{ id: 'topic:p1-self-image', title: 'Self-image', level: 'topic', pillar: 'P1', cluster: null, matchedBy: 'keywords', matchReason: 'shared words: self, image', score: 3 }],
  questions: [{ text: 'how to change your self image', kind: 'query', source: 'google_ac', topicId: 'topic:p1-self-image' }],
  words: [{ text: 'back to my old self every January', kind: 'quote', source: 'reddit', topicId: 'topic:p1-self-image' }],
  claims: [],
  sources: [
    { id: 'S1', chunkId: 'chunk-1', textName: 'paper_a', author: 'Author A', section: 'Results', tier: 'evidence', url: 'https://example.org/a', excerpt: 'Self-concept shapes attention.', via: 'search', phrase: 'self image' },
  ],
  firstHand: [{ id: 'A1', text: 'You cannot out-perform your self-image.', kind: 'insight', where: 'the insight this source carries', sourceRef: 'article · self-image', refId: 'i-1' }],
  links: [{ url: 'https://quantumstrategies.online/articles/self-image/', label: 'Self-image', kind: 'article', status: 'LIVE' }],
  phrases: ['self image'],
  gaps: ['Only 1 evidence passage found (full-text search; vector search is down until the Voyage migration). Expect [NEEDS SOURCE] marks.'],
  counts: { sources: 1, firstHand: 1, questions: 1, words: 1, links: 1, topics: 1 },
};

beforeEach(() => {
  generateText.mockReset();
  generateValidatedVideoScript.mockReset();
  buildResearchPack.mockReset();
  buildResearchPack.mockResolvedValue(PACK);
});

// ── offeredTargets ──────────────────────────────────────────────────────────

describe('offeredTargets', () => {
  it('groups by FORM_RANK relative to the source', () => {
    const g = offeredTargets('reddit_post');
    expect(g.longer).toEqual(['youtube_long', 'blog']);
    expect(g.same.sort()).toEqual(['reddit_post', 'x_article']);
    expect(g.shorter[0]).toBe('ig_carousel');
    expect(g.shorter).toContain('social_twitter');
    expect(g.shorter.at(-1)).toBe('ig_lettering');
    for (const t of g.longer) expect(FORM_RANK[t]).toBeGreaterThan(FORM_RANK.reddit_post);
    for (const t of g.shorter) expect(FORM_RANK[t]).toBeLessThan(FORM_RANK.reddit_post);
  });

  it('puts everything shorter for a pillar article and longer for a lettering line', () => {
    expect(offeredTargets('article').longer).toEqual([]);
    expect(offeredTargets('article').same).toEqual(['youtube_long']); // equal length, across
    expect(offeredTargets('article').shorter).toHaveLength(OFFERED_TARGETS.length - 1);
    expect(offeredTargets('ig_lettering').shorter).toEqual([]);
    expect(offeredTargets('ig_lettering').same).toEqual(['ig_lettering']);
  });

  it('never offers LinkedIn or GPT products', () => {
    const all = new Set<string>(OFFERED_TARGETS);
    expect(all.has('social_linkedin')).toBe(false);
    expect(all.has('gpt_product')).toBe(false);
    for (const form of Object.keys(FORM_RANK) as (PieceType | 'article')[]) {
      const g = offeredTargets(form);
      expect([...g.longer, ...g.same, ...g.shorter]).not.toContain('social_linkedin');
    }
  });
});

// ── prompts ─────────────────────────────────────────────────────────────────

describe('buildMakePrompt', () => {
  const source: LoadedSource = { form: 'social_twitter', title: 'line', text: 'You cannot out-perform your self-image.', platform: 'x' };

  it('carries the up rule (expand only from the source, mark [NEEDS SOURCE]) when going longer', () => {
    const { user } = buildMakePrompt({ source, sourceRef: { kind: 'piece', id: PIECE_ID }, target: 'blog', direction: 'up' });
    expect(user).toContain(UP_RULE);
    expect(user).toContain('[NEEDS SOURCE]');
    expect(user).toContain('600 to 1,200 words');
    expect(user).not.toContain(DOWN_RULE);
  });

  it('carries the down rule (never add a claim) when going shorter', () => {
    const { user } = buildMakePrompt({
      source: { form: 'article', title: 'A', text: 'body', articleUrl: 'https://quantumstrategies.online/articles/a/' },
      sourceRef: { kind: 'article', id: ARTICLE_ID },
      target: 'social_twitter',
      direction: 'down',
    });
    expect(user).toContain(DOWN_RULE);
    expect(user).toMatch(/Never add a claim the source does not carry/);
    expect(user).toContain('120 characters or fewer');
    expect(user).toMatch(/never video/i);
  });

  it('adds the research pack and citation rules when a pack is given', () => {
    const { user } = buildMakePrompt({ source, sourceRef: { kind: 'piece', id: PIECE_ID }, target: 'blog', direction: 'up', research: PACK });
    expect(user).toContain(UP_RULE);
    expect(user).toContain(UP_RESEARCH_RULE);
    for (const r of RESEARCH_RULES) expect(user).toContain(r);
    expect(user).toMatch(/cites its source right after it as \[S#\]/);
    expect(user).toMatch(/A claim no S# supports gets \[NEEDS SOURCE\]/);
    expect(user).toMatch(/cited \[A#\]\. If none fits, write \[AUSTIN: <a specific question for him>\]/);
    expect(user).toMatch(/Answer at least 2 of the AUDIENCE QUESTIONS/);
    expect(user).toContain('RESEARCH PACK');
    expect(user).toContain('[S1] Author A, paper_a, Results · tier: evidence');
    expect(user).toContain('AUDIENCE QUESTIONS AND WORDS:');
    expect(user).toContain('- Q (search): how to change your self image');
    expect(user).toContain('[A1] "You cannot out-perform your self-image."');
    expect(user).toContain('INTERNAL LINKS:');
    expect(user).toContain('https://quantumstrategies.online/articles/self-image/');
    // the pack sits before the source
    expect(user.indexOf('RESEARCH PACK')).toBeLessThan(user.indexOf('SOURCE: line'));
  });

  it('has no research block without a pack', () => {
    const { user } = buildMakePrompt({ source, sourceRef: { kind: 'piece', id: PIECE_ID }, target: 'blog', direction: 'up' });
    expect(user).not.toContain('RESEARCH PACK');
    expect(user).not.toContain(UP_RESEARCH_RULE);
  });

  it('reddit specs say no links and answer the how', () => {
    const { user } = buildMakePrompt({ source, sourceRef: { kind: 'piece', id: PIECE_ID }, target: 'reddit_post', direction: 'up' });
    expect(user).toMatch(/No links at all/);
    expect(user).toMatch(/answer the how inside the post/i);
  });
});

// ── cleanup + lint ──────────────────────────────────────────────────────────

describe('stripEmDashes / lintMade', () => {
  it('removes em dashes and spaced en dashes, keeps numeric ranges', () => {
    expect(stripEmDashes('Look at the path — not the tree.')).toBe('Look at the path, not the tree.');
    expect(stripEmDashes('6–10 frames – plain')).toBe('6–10 frames, plain');
    expect(stripEmDashes('ends here—.')).toBe('ends here.');
  });

  it('flags long X lines, links on Reddit and missing sources', () => {
    const x = lintMade('a'.repeat(130), 'social_twitter', FALLBACK_VOICE_PACK);
    expect(x.some((w) => w.includes('130 characters'))).toBe(true);
    const r = lintMade('See https://example.com/x for more. [NEEDS SOURCE]', 'reddit', FALLBACK_VOICE_PACK);
    expect(r.some((w) => /no links/.test(w))).toBe(true);
    expect(r.some((w) => /NEEDS SOURCE/.test(w))).toBe(true);
  });
});

// ── makeAsset ───────────────────────────────────────────────────────────────

describe('makeAsset', () => {
  it('makes an X line from an article: down edge, article carried, em dashes stripped', async () => {
    const { client, inserts } = fakeClient({ content_posts: ARTICLE });
    generateText.mockResolvedValueOnce(
      reply({ title: 'Tree line — X', body: 'Stare at the tree — you hit the tree.', meta: { image_idea: 'Lettering — tree' } }),
    );

    const res = await makeAsset(client, { source: { kind: 'article', id: ARTICLE_ID }, target: 'social_twitter', createdBy: 'admin-1' });

    expect(res.piece).toEqual({ id: 'content_pieces-new', title: 'Tree line, X', piece_type: 'social_twitter' });
    expect(res.linkId).toBe('content_asset_links-new');

    const piece = inserts.find((i) => i.table === 'content_pieces')!.row;
    expect(piece.body).toBe('Stare at the tree, you hit the tree.');
    expect(String(piece.body)).not.toContain('—');
    expect(piece.status).toBe('draft');
    expect(piece.source_post_id).toBe(ARTICLE_ID);
    expect(piece.notes).toBe(`Made from article ${ARTICLE_ID}`);
    const meta = piece.platform_meta as Record<string, unknown>;
    expect(meta.made_from).toEqual({ kind: 'article', id: ARTICLE_ID });
    expect(meta.direction).toBe('down');
    expect(meta.image_idea).toBe('Lettering, tree');

    const link = inserts.find((i) => i.table === 'content_asset_links')!.row;
    expect(link).toMatchObject({ from_kind: 'article', from_id: ARTICLE_ID, to_kind: 'piece', to_id: 'content_pieces-new', direction: 'down', created_by: 'admin-1' });

    const call = generateText.mock.calls[0][0] as { tier: string; system: string; messages: { content: string }[] };
    expect(call.tier).toBe('standard');
    expect(call.messages[0].content).toContain(DOWN_RULE);
    expect(call.system).toContain('VOICE RULES');
  });

  it('goes up from a piece, carrying its insight onto the new piece and the edge', async () => {
    const { client, inserts } = fakeClient({
      content_pieces: {
        id: PIECE_ID,
        piece_type: 'social_twitter',
        title: 'line',
        body: 'You cannot out-perform your self-image.',
        platform_meta: {},
        source_post_id: ARTICLE_ID,
        insight_id: INSIGHT_ID,
        angle_id: null,
        source: { id: ARTICLE_ID, slug: 'self-image' },
      },
      content_insights: { line: 'You cannot out-perform your self-image.', claim: null },
    });
    generateText.mockResolvedValueOnce(reply({ title: 'Self-image post', body: 'I used to think... [NEEDS SOURCE]', meta: { subreddit: 'r/getdisciplined' } }));

    const res = await makeAsset(client, { source: { kind: 'piece', id: PIECE_ID }, target: 'reddit_post' });

    const piece = inserts.find((i) => i.table === 'content_pieces')!.row;
    expect(piece.insight_id).toBe(INSIGHT_ID);
    expect(piece.piece_type).toBe('reddit_post');
    expect((piece.platform_meta as Record<string, unknown>).direction).toBe('up');
    const link = inserts.find((i) => i.table === 'content_asset_links')!.row;
    expect(link).toMatchObject({ direction: 'up', insight_id: INSIGHT_ID, from_kind: 'piece' });
    expect(res.warnings.some((w) => w.includes('NEEDS SOURCE'))).toBe(true);
    const user = (generateText.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    expect(user).toContain(UP_RULE);
    expect(user).toContain('THE INSIGHT THIS CARRIES');
  });

  it('going up builds the research pack, cites it in the prompt, saves it and warns on gaps', async () => {
    const { client, inserts } = fakeClient({
      content_pieces: { id: PIECE_ID, piece_type: 'social_twitter', title: 'line', body: 'You cannot out-perform your self-image.', platform_meta: {}, source_post_id: ARTICLE_ID, insight_id: INSIGHT_ID, angle_id: null, source: { id: ARTICLE_ID, slug: 'self-image' } },
      content_insights: { line: 'You cannot out-perform your self-image.', claim: null },
    });
    generateText.mockResolvedValueOnce(
      reply({ title: 'Self-image spoke', body: `${'word '.repeat(650)}Attention follows self-concept [S1]. A number [NEEDS SOURCE]. A second [NEEDS SOURCE]. [AUSTIN: when did you first notice this?]`, meta: {} }),
    );

    const res = await makeAsset(client, { source: { kind: 'piece', id: PIECE_ID }, target: 'blog' });

    expect(buildResearchPack).toHaveBeenCalledOnce();
    const [, args] = buildResearchPack.mock.calls[0] as [unknown, { source: Record<string, unknown>; target: string }];
    expect(args.target).toBe('blog');
    expect(args.source).toMatchObject({ sourcePostId: ARTICLE_ID, insightId: INSIGHT_ID, pieceId: PIECE_ID });

    const user = (generateText.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    expect(user).toContain(UP_RULE);
    expect(user).toContain('RESEARCH PACK');
    expect(user).toContain('[S1]');

    const meta = inserts.find((i) => i.table === 'content_pieces')!.row.platform_meta as { research: Record<string, unknown>; warnings: string[] };
    expect(meta.research.topic_id).toBe('topic:p1-self-image');
    expect(meta.research.sources).toEqual([expect.objectContaining({ id: 'S1', chunk_id: 'chunk-1', tier: 'evidence' })]);
    expect(meta.research.gaps).toEqual(PACK.gaps);
    expect(meta.research.counts).toEqual(PACK.counts);

    expect(res.warnings).toContain('2 claims marked [NEEDS SOURCE]: source or cut before publishing.');
    expect(res.warnings).toContain('1 [AUSTIN] gap to fill in his words.');
    expect(res.warnings).toContain(`Research gap: ${PACK.gaps[0]}`);
    expect(meta.warnings).toContain(`Research gap: ${PACK.gaps[0]}`);
    expect(res.research).toEqual({
      topic: { id: 'topic:p1-self-image', title: 'Self-image', matchedBy: 'keywords', reason: 'shared words: self, image' },
      sources: 1,
      firstHand: 1,
      questions: 1,
      links: 1,
      gaps: PACK.gaps,
      long: true,
    });
  });

  it('skips research for a short target going down', async () => {
    const { client, inserts } = fakeClient({ content_posts: ARTICLE });
    generateText.mockResolvedValueOnce(reply({ title: 't', body: 'Stare at the tree.', meta: {} }));
    const res = await makeAsset(client, { source: { kind: 'article', id: ARTICLE_ID }, target: 'social_twitter' });
    expect(buildResearchPack).not.toHaveBeenCalled();
    expect(res.research).toBeNull();
    expect((inserts.find((i) => i.table === 'content_pieces')!.row.platform_meta as Record<string, unknown>).research).toBeUndefined();
    expect((generateText.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content).not.toContain('RESEARCH PACK');
  });

  it('builds research for a long target going down (article to spoke)', async () => {
    const { client } = fakeClient({ content_posts: ARTICLE });
    generateText.mockResolvedValueOnce(reply({ title: 't', body: 'word '.repeat(700), meta: {} }));
    const res = await makeAsset(client, { source: { kind: 'article', id: ARTICLE_ID }, target: 'blog' });
    expect(buildResearchPack).toHaveBeenCalledOnce();
    const user = (generateText.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    expect(user).toContain(DOWN_RULE);
    expect(user).toMatch(/does not license new claims/);
    expect(res.research?.long).toBe(true);
  });

  it('still makes the draft when the research pack fails', async () => {
    buildResearchPack.mockRejectedValueOnce(new Error('kg_nodes: timeout'));
    const { client, inserts } = fakeClient({ content_posts: ARTICLE });
    generateText.mockResolvedValueOnce(reply({ title: 't', body: 'word '.repeat(700), meta: {} }));
    const res = await makeAsset(client, { source: { kind: 'article', id: ARTICLE_ID }, target: 'blog' });
    expect(res.research).toBeNull();
    expect(res.warnings.some((w) => /research pack could not be built \(kg_nodes: timeout\)/.test(w))).toBe(true);
    expect(inserts.some((i) => i.table === 'content_pieces')).toBe(true);
  });

  it('an explicit insightId wins over the source insight', async () => {
    const other = '44444444-4444-4444-8444-444444444444';
    const { client, inserts } = fakeClient({ content_posts: ARTICLE, content_insights: { line: 'x' } });
    generateText.mockResolvedValueOnce(reply({ title: 't', body: 'One line here', meta: {} }));
    await makeAsset(client, { source: { kind: 'article', id: ARTICLE_ID }, target: 'ig_lettering', insightId: other });
    expect(inserts.find((i) => i.table === 'content_pieces')!.row.insight_id).toBe(other);
    expect(inserts.find((i) => i.table === 'content_asset_links')!.row.insight_id).toBe(other);
  });

  it('uses the video-script generator for a long video', async () => {
    const { client, inserts } = fakeClient({ content_posts: ARTICLE });
    generateValidatedVideoScript.mockResolvedValueOnce({
      raw: {},
      attempts: 1,
      history: [],
      validation: { pass: true, errors: [], warnings: [], score: 9, timing: {}, script: { title: 'Script title' } },
    });
    const res = await makeAsset(client, { source: { kind: 'article', id: ARTICLE_ID }, target: 'youtube_long' });
    expect(generateValidatedVideoScript).toHaveBeenCalledOnce();
    const opts = generateValidatedVideoScript.mock.calls[0][0] as { variant: string; brief: { material: string } };
    expect(opts.variant).toBe('long');
    expect(opts.brief.material).toContain(SAME_RULE); // article and long video are equal length (across)
    // long video: the research pack goes into the brief (sources separately, the rest in material)
    expect(buildResearchPack).toHaveBeenCalledOnce();
    expect((opts.brief as { sources?: string }).sources).toContain('[S1] Author A, paper_a');
    expect(opts.brief.material).toContain('RESEARCH PACK');
    expect(opts.brief.material).toContain('[A1]');
    expect(res.research?.sources).toBe(1);
    expect(generateText).not.toHaveBeenCalled();
    const piece = inserts.find((i) => i.table === 'content_pieces')!.row;
    expect(piece.piece_type).toBe('youtube_long');
    expect(piece.body).toBe('RENDERED SCRIPT, with a dash');
    expect(res.piece.title).toBe('Script title');
  });

  it('requires pasted text for an external source and rejects LinkedIn targets', async () => {
    const { client } = fakeClient({});
    await expect(
      makeAsset(client, { source: { kind: 'external', id: 'https://www.reddit.com/r/x/comments/abc/t/' }, target: 'blog' }),
    ).rejects.toThrow(/extra context/);
    await expect(
      makeAsset(client, { source: { kind: 'article', id: ARTICLE_ID }, target: 'social_linkedin' as PieceType }),
    ).rejects.toThrow(/not offered/);
  });

  it('makes from an external Reddit post with pasted text (up to an article, no source post)', async () => {
    const { client, inserts } = fakeClient({});
    generateText.mockResolvedValueOnce(reply({ title: 'Spoke', body: 'word '.repeat(700), meta: {} }));
    await makeAsset(client, {
      source: { kind: 'external', id: 'https://www.reddit.com/r/Manifestation/comments/abc/title/' },
      target: 'blog',
      extraContext: 'My post text, 138 upvotes.',
    });
    const piece = inserts.find((i) => i.table === 'content_pieces')!.row;
    expect(piece.source_post_id).toBeNull();
    expect((piece.platform_meta as Record<string, unknown>).direction).toBe('up');
    const user = (generateText.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    expect(user).toContain('My post text, 138 upvotes.');
  });
});
