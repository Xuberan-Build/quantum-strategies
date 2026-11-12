/* eslint-disable @typescript-eslint/no-explicit-any -- in-memory supabase fake */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveInsight, assetsForInsight, createInsight, getInsight, listInsights, parseInsightInput, setAssetInsight, updateInsight } from '../insights';
import { FakeDb, uuid } from './fake-db';

vi.mock('@/lib/ai/generate', async (orig) => ({ ...(await orig<typeof import('@/lib/ai/generate')>()), generateText: vi.fn() }));
vi.mock('@/lib/content/voice-pack', () => ({ getVoicePack: vi.fn(async () => ({})), buildVoiceSystemPrompt: vi.fn(() => 'SYSTEM') }));

import { generateText } from '@/lib/ai/generate';
import { articleToSections, cleanCandidates, extractInsightsFromArticle, stripEmDashes } from '../extract';

describe('parseInsightInput', () => {
  it('requires a line on create and validates fields', () => {
    expect(parseInsightInput({}).errors).toContain('line is required');
    expect(parseInsightInput({ line: 'x', source_kind: 'tiktok' }).errors[0]).toMatch(/source_kind/);
    expect(parseInsightInput({ line: 'x', source_post_id: 'nope' }).errors[0]).toMatch(/uuid/);
    expect(parseInsightInput({ line: 'x', tags: [1] }).errors[0]).toMatch(/tags/);
    const { value } = parseInsightInput({ line: '  An idea.  ', tags: ['a', ' a ', 'b', ''], claim: '', pillar: 'P2' });
    expect(value).toEqual({ line: 'An idea.', tags: ['a', 'b'], claim: null, pillar: 'P2' });
  });

  it('patches allow partial bodies but not empty ones', () => {
    expect(parseInsightInput({}, { partial: true }).errors).toEqual(['Nothing to update']);
    expect(parseInsightInput({ status: 'archived' }, { partial: true }).value).toEqual({ status: 'archived' });
    expect(parseInsightInput({ line: '' }, { partial: true }).errors).toContain('line is required');
  });
});

describe('insight CRUD', () => {
  let db: FakeDb;
  beforeEach(() => { db = new FakeDb(); });

  it('creates, lists with filters, updates and archives', async () => {
    const post = uuid();
    const a = await createInsight(db as any, { line: 'You cannot out-perform your self-image.', source_post_id: post, pillar: 'P1' }, uuid());
    expect(a.source_kind).toBe('article');
    await createInsight(db as any, { line: 'Box breathing resets the alarm.', source_kind: 'x', pillar: 'P3', claim: 'Slow breathing lowers heart rate' });
    expect(await listInsights(db as any)).toHaveLength(2);
    expect((await listInsights(db as any, { pillar: 'P3' })).map((i) => i.source_kind)).toEqual(['x']);
    expect(await listInsights(db as any, { sourceKind: 'article' })).toHaveLength(1);
    expect(await listInsights(db as any, { q: 'heart' })).toHaveLength(1);   // matches the claim
    expect(await listInsights(db as any, { q: 'self-image' })).toHaveLength(1);
    expect(await listInsights(db as any, { postId: post })).toHaveLength(1);

    const updated = await updateInsight(db as any, a.id, { pillar: 'P2' });
    expect(updated?.pillar).toBe('P2');
    expect((await archiveInsight(db as any, a.id))?.status).toBe('archived');
    expect(await listInsights(db as any)).toHaveLength(1);
    expect(await listInsights(db as any, { status: 'archived' })).toHaveLength(1);
    expect(await listInsights(db as any, { status: 'all' })).toHaveLength(2);
    expect(await getInsight(db as any, 'not-a-uuid')).toBeNull();
    expect((await getInsight(db as any, a.id))?.id).toBe(a.id);
    expect(await updateInsight(db as any, uuid(), { pillar: 'P1' })).toBeNull();
  });

  it('collects every asset carrying an insight', async () => {
    const insight = uuid(), article = uuid(), piece = uuid(), post = uuid(), other = uuid();
    db.tables.content_insights = [{ id: insight, line: 'Line', status: 'active', source_kind: 'article', source_post_id: article, tags: [] }];
    db.tables.content_posts = [{ id: article, slug: 'a', title: 'Article A', is_published: true }];
    db.tables.content_pieces = [
      { id: piece, title: 'Piece', piece_type: 'reddit', status: 'draft', insight_id: insight },
      { id: other, title: 'Other', piece_type: 'blog', status: 'draft', insight_id: null },
    ];
    db.tables.social_posts = [{ id: post, caption: 'Caption', status: 'draft', insight_id: insight, piece_id: null }];
    db.tables.social_post_targets = [{ post_id: post, platform: 'x', format: 'tweet' }];
    db.tables.content_asset_links = [{ id: uuid(), from_kind: 'article', from_id: article, to_kind: 'insight', to_id: insight, direction: 'same', insight_id: insight, note: null }];

    const r = await assetsForInsight(db as any, insight);
    expect(r.pieces.map((p) => p.title)).toEqual(['Piece']);
    expect(r.socialPosts[0]).toMatchObject({ title: 'Caption', platforms: ['x'], form: 'social_twitter' });
    expect(r.links[0].from.title).toBe('Article A');
    expect(r.links[0].to.kind).toBe('insight');
    expect(r.source?.title).toBe('Article A');
  });

  it('sets and clears insight_id on pieces and posts only', async () => {
    const piece = uuid(), insight = uuid();
    db.tables.content_pieces = [{ id: piece, insight_id: null }];
    expect(await setAssetInsight(db as any, { kind: 'piece', id: piece }, insight)).toBe(true);
    expect(db.tables.content_pieces[0].insight_id).toBe(insight);
    expect(await setAssetInsight(db as any, { kind: 'piece', id: piece }, null)).toBe(true);
    expect(db.tables.content_pieces[0].insight_id).toBeNull();
    expect(await setAssetInsight(db as any, { kind: 'social_post', id: uuid() }, null)).toBe(false);
    await expect(setAssetInsight(db as any, { kind: 'article', id: uuid() }, null)).rejects.toThrow();
  });
});

describe('extractInsightsFromArticle', () => {
  const body = [
    '# Self-image',
    'Intro words about the self-image and why effort stalls.',
    '',
    '## The thermostat',
    'You cannot out-perform your self-image. Your behaviour returns to the setting you hold about yourself.',
    'A 2019 study by [Smith](https://example.org/smith) found that identity statements changed follow-through.',
    '',
    '## The practice',
    'Write the identity line every morning before you check your phone, then act on it once before noon.',
  ].join('\n');
  let db: FakeDb;
  const postId = uuid();
  beforeEach(() => {
    db = new FakeDb();
    db.tables.content_posts = [{ id: postId, slug: 'self-image', title: 'Self-image', excerpt: null, body }];
    vi.mocked(generateText).mockReset();
  });

  it('splits sections and strips em dashes', () => {
    expect(articleToSections(body).map((s) => s.heading)).toEqual(['Self-image', 'The thermostat', 'The practice']);
    expect(stripEmDashes('You stall — every time — and 8–14 minutes')).toBe('You stall, every time, and 8 to 14 minutes');
  });

  it('returns grounded candidates, drops invented ones, never saves', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ candidates: [
        { line: 'You cannot out-perform your self-image — ever.', source_ref: 'the thermostat', claim: null, claim_source: null },
        { line: 'Identity statements changed follow-through.', source_ref: 'The thermostat', claim: 'Identity statements changed follow-through', claim_source: 'Smith 2019, https://example.org/smith' },
        { line: 'Quantum manifestation guarantees wealth overnight for everyone.', source_ref: 'Nowhere', claim: null, claim_source: null },
        { line: 'You cannot out-perform your self-image, ever.', source_ref: 'The thermostat' },
        { line: 'short' },
      ] }),
      finishReason: 'stop', usage: { prompt: 0, completion: 0, total: 0 }, provider: 'anthropic', model: 'claude',
    });
    const r = await extractInsightsFromArticle(db as any, postId);
    expect(r.post.slug).toBe('self-image');
    expect(r.candidates.map((c) => c.line)).toEqual([
      'You cannot out-perform your self-image, ever.',
      'Identity statements changed follow-through.',
    ]);
    expect(r.candidates[0].source_ref).toBe('The thermostat'); // normalised to the real heading
    expect(r.candidates[1].claim).toBe('Identity statements changed follow-through (source: Smith 2019, https://example.org/smith)');
    expect(r.candidates.every((c) => !c.line.includes('—'))).toBe(true);
    expect(db.calls.filter((c) => c.op !== 'select')).toHaveLength(0);
    const opts = vi.mocked(generateText).mock.calls[0][0];
    expect(opts.system).toBe('SYSTEM');
    expect(opts.json).toBe(true);
    expect(String(opts.messages[0].content)).toContain('## The practice');
  });

  it('errors on a missing article or an unparseable reply', async () => {
    await expect(extractInsightsFromArticle(db as any, uuid())).rejects.toThrow(/not found/);
    await expect(extractInsightsFromArticle(db as any, 'bad')).rejects.toThrow(/uuid/);
    vi.mocked(generateText).mockResolvedValue({ text: 'no json here', finishReason: 'stop', usage: { prompt: 0, completion: 0, total: 0 }, provider: 'anthropic', model: 'm' });
    await expect(extractInsightsFromArticle(db as any, postId)).rejects.toThrow(/expected shape/);
  });

  it('cleanCandidates accepts a bare array and caps at 12', () => {
    const text = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa';
    const many = Array.from({ length: 20 }, (_, i) => ({ line: `alpha bravo charlie ${text.split(' ')[i % 16]} number${i}` }));
    // "number{i}" isn't in the text: grounding 4/5 = 0.8 keeps them
    expect(cleanCandidates(many, text, [])).toHaveLength(12);
  });
});
