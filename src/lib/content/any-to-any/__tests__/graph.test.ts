/* eslint-disable @typescript-eslint/no-explicit-any -- in-memory supabase fake */
import { beforeEach, describe, expect, it } from 'vitest';
import { assetGraph, directionFor, formForSocialTarget, formRelation, GraphValidationError, inferDirection, linkAssets, parseAssetRef, resolveAssets, sourceFormForInsight, unlinkAssets } from '../graph';
import { FakeDb, uuid } from './fake-db';

describe('directionFor', () => {
  it('goes down to a shorter form and up to a longer one', () => {
    expect(directionFor('article', 'short')).toBe('down');
    expect(directionFor('social_twitter', 'reddit_post')).toBe('up');
    expect(directionFor('reddit', 'youtube_long')).toBe('up');
    expect(directionFor('article', 'youtube_long')).toBe('across'); // equal rank, site vs youtube
    expect(directionFor('youtube_long', 'ig_lettering')).toBe('down');
  });

  it('is same at equal rank on the same platform, across on a different one', () => {
    expect(directionFor('reddit_post', 'x_article')).toBe('across'); // both 70: reddit vs x
    expect(directionFor('short', 'social_tiktok')).toBe('across');   // both 50: vertical vs tiktok
    expect(directionFor('blog', 'blog')).toBe('same');
    expect(directionFor('reddit_post', 'x_article', true)).toBe('same');
    expect(directionFor('blog', 'blog', false)).toBe('across');
  });

  it('treats unknown (old) forms as across', () => {
    expect(directionFor('social_linkedin', 'short')).toBe('across');
    expect(directionFor('article', 'gpt_product')).toBe('across');
  });

  it('formRelation groups longer / same / shorter', () => {
    expect(formRelation('article', 'blog')).toBe('shorter');
    expect(formRelation('article', 'youtube_long')).toBe('same'); // equal rank in FORM_RANK
    expect(formRelation('social_twitter', 'blog')).toBe('longer');
    expect(formRelation('short', 'social_tiktok')).toBe('same');
    expect(formRelation(null, 'blog')).toBeNull();
  });

  it('maps insight sources and publisher formats to forms', () => {
    expect(sourceFormForInsight({ source_kind: 'article' })).toBe('article');
    expect(sourceFormForInsight({ source_kind: 'vcap' })).toBe('youtube_long');
    expect(sourceFormForInsight({ source_kind: 'reddit' })).toBe('reddit_post');
    expect(sourceFormForInsight({ source_kind: 'recording' })).toBeNull();
    expect(formForSocialTarget('youtube', 'video')).toBe('youtube_long');
    expect(formForSocialTarget('instagram', 'trial_reel')).toBe('short');
    expect(formForSocialTarget('x', 'image')).toBe('social_twitter');
    expect(formForSocialTarget('instagram', 'carousel')).toBe('ig_carousel');
  });
});

describe('parseAssetRef / linkAssets validation', () => {
  let db: FakeDb;
  beforeEach(() => { db = new FakeDb(); });

  it('requires uuids for internal kinds and http urls for external', () => {
    expect(() => parseAssetRef({ kind: 'piece', id: 'abc' })).toThrow(GraphValidationError);
    expect(() => parseAssetRef({ kind: 'nope', id: uuid() })).toThrow(/kind must be/);
    expect(() => parseAssetRef({ kind: 'external', id: 'javascript:alert(1)' })).toThrow(/http/);
    expect(() => parseAssetRef(null)).toThrow();
    expect(parseAssetRef({ kind: 'external', id: ' https://reddit.com/r/x/1 ' })).toEqual({ kind: 'external', id: 'https://reddit.com/r/x/1' });
  });

  it('rejects self links, bad directions and bad insight ids', async () => {
    const id = uuid();
    await expect(linkAssets(db as any, { from: { kind: 'piece', id }, to: { kind: 'piece', id }, direction: 'down' })).rejects.toThrow(/itself/);
    await expect(linkAssets(db as any, { from: { kind: 'piece', id }, to: { kind: 'article', id: uuid() }, direction: 'sideways' as any })).rejects.toThrow(/direction/);
    await expect(linkAssets(db as any, { from: { kind: 'piece', id }, to: { kind: 'article', id: uuid() }, direction: 'up', insightId: 'x' })).rejects.toThrow(/insightId/);
    expect(db.tables.content_asset_links ?? []).toHaveLength(0);
  });

  it('upserts on the unique key and keeps insight_id when not given', async () => {
    const from = { kind: 'article' as const, id: uuid() };
    const to = { kind: 'piece' as const, id: uuid() };
    const insightId = uuid();
    const a = await linkAssets(db as any, { from, to, direction: 'down', insightId, note: '  first  ' });
    expect(a.note).toBe('first');
    const b = await linkAssets(db as any, { from, to, direction: 'across' });
    expect(db.tables.content_asset_links).toHaveLength(1);
    expect(b.id).toBe(a.id);
    expect(b.direction).toBe('across');
    expect(b.insight_id).toBe(insightId);
    expect(await unlinkAssets(db as any, a.id)).toBe(true);
    expect(await unlinkAssets(db as any, a.id)).toBe(false);
  });
});

describe('assetGraph', () => {
  const article = uuid(1), piece = uuid(2), post = uuid(3), insight = uuid(4), piece2 = uuid(5), missing = uuid(6);
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
    db.tables.content_posts = [{ id: article, slug: 'self-image', title: 'Self-image article', is_published: true }];
    db.tables.content_pieces = [
      { id: piece, title: 'Short: the thermostat', piece_type: 'short', status: 'approved', insight_id: insight, source_post_id: article },
      { id: piece2, title: 'Carousel', piece_type: 'ig_carousel', status: 'draft', insight_id: null, source_post_id: null },
    ];
    db.tables.social_posts = [{ id: post, title: null, caption: 'You cannot out-perform your self-image.', status: 'published', insight_id: insight, piece_id: piece }];
    db.tables.social_post_targets = [{ post_id: post, platform: 'instagram', format: 'reel' }, { post_id: post, platform: 'tiktok', format: 'tiktok_video' }];
    db.tables.content_insights = [{ id: insight, line: 'You cannot out-perform your self-image.', status: 'active', source_kind: 'article', tags: [] }];
    db.tables.content_asset_links = [
      { id: uuid(7), from_kind: 'piece', from_id: piece, to_kind: 'piece', to_id: piece2, direction: 'across', insight_id: insight, note: null },
      { id: uuid(8), from_kind: 'piece', from_id: piece, to_kind: 'external', to_id: 'https://www.reddit.com/r/Manifestation/comments/abc', direction: 'across', insight_id: null, note: null },
      { id: uuid(9), from_kind: 'article', from_id: article, to_kind: 'piece', to_id: piece, direction: 'down', insight_id: null, note: 'explicit' },
      { id: uuid(10), from_kind: 'piece', from_id: piece, to_kind: 'social_post', to_id: missing, direction: 'same', insight_id: null, note: null },
    ];
  });

  it('resolves parents, children and the insight for a piece', async () => {
    const g = await assetGraph(db as any, { kind: 'piece', id: piece });
    expect(g.asset).toMatchObject({ title: 'Short: the thermostat', form: 'short', href: `/admin/studio/social-calendar/${piece}` });
    // explicit article link wins over the implicit source_post_id edge (no duplicate)
    expect(g.parents).toHaveLength(1);
    expect(g.parents[0]).toMatchObject({ implicit: false, note: 'explicit', asset: { kind: 'article', title: 'Self-image article', href: '/admin/content/self-image' } });
    const kids = Object.fromEntries(g.children.map((c) => [`${c.asset.kind}:${c.asset.id}`, c]));
    expect(kids[`piece:${piece2}`].asset.title).toBe('Carousel');
    expect(kids['external:https://www.reddit.com/r/Manifestation/comments/abc'].asset).toMatchObject({ title: 'reddit.com/r/Manifestation/comments/abc', href: 'https://www.reddit.com/r/Manifestation/comments/abc' });
    expect(kids[`social_post:${missing}`].asset.missing).toBe(true);
    expect(kids[`social_post:${post}`]).toMatchObject({ implicit: true, linkId: null });
    expect(kids[`social_post:${post}`].asset).toMatchObject({ title: 'You cannot out-perform your self-image.', platforms: ['instagram', 'tiktok'], form: 'short' });
    expect(g.insight?.id).toBe(insight);
  });

  it('gives a social post its piece as an implicit parent', async () => {
    const g = await assetGraph(db as any, { kind: 'social_post', id: post });
    expect(g.parents.map((p) => p.asset.id)).toEqual([piece]);
    expect(g.asset.href).toBe(`/admin/social/compose?post=${post}`);
  });

  it('lists an article\'s pieces and resolves insight assets', async () => {
    const g = await assetGraph(db as any, { kind: 'article', id: article });
    expect(g.children.map((c) => c.asset.id)).toEqual([piece]);
    expect(g.insight).toBeNull();
    const [i] = await resolveAssets(db as any, [{ kind: 'insight', id: insight }]);
    expect(i).toMatchObject({ form: 'article', href: `/admin/studio/insights/${insight}` });
  });

  it('infers direction from the stored forms', async () => {
    expect(await inferDirection(db as any, { kind: 'article', id: article }, { kind: 'piece', id: piece })).toBe('down');
    expect(await inferDirection(db as any, { kind: 'piece', id: piece2 }, { kind: 'article', id: article })).toBe('up');
    expect(await inferDirection(db as any, { kind: 'piece', id: piece }, { kind: 'external', id: 'https://x.com/a' })).toBe('across');
  });

  it('rejects a bad ref', async () => {
    await expect(assetGraph(db as any, { kind: 'piece', id: 'nope' })).rejects.toThrow(GraphValidationError);
  });
});
