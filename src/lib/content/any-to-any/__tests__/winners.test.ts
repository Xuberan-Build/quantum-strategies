import { beforeEach, describe, expect, it, vi } from 'vitest';

const makeAssetMock = vi.fn();
vi.mock('@/lib/content/any-to-any/make', () => ({ makeAsset: (...args: unknown[]) => makeAssetMock(...args) }));

import { FORM_RANK } from '../types';
import {
  acceptPromotion,
  addExternalWinner,
  channelMedians,
  dismissPromotion,
  findWinners,
  markDone,
  proposePromotion,
  suggestFormats,
  syncDonePromotions,
} from '../winners';

// ---- in-memory fake of the supabase query builder (just what winners.ts uses)
type Row = Record<string, any>;
let idSeq = 0;
class FakeDb {
  tables: Record<string, Row[]> = {};
  from(name: string) {
    this.tables[name] ??= [];
    return new Query(this.tables[name]);
  }
}
class Query implements PromiseLike<any> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'update' | 'insert' = 'select';
  private patch: Row = {};
  private max = Infinity;
  constructor(private rows: Row[]) {}
  select(_cols?: string) { return this; }
  insert(r: Row) { this.op = 'insert'; this.patch = r; return this; }
  update(p: Row) { this.op = 'update'; this.patch = p; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { return this.run().then((r) => ({ data: r.data?.[0] ?? null, error: null })); }
  single() { return this.maybeSingle(); }
  private async run(): Promise<{ data: Row[] | null; error: null }> {
    if (this.op === 'insert') {
      const row = { id: `promo${++idSeq}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), piece_id: null, ...this.patch };
      this.rows.push(row);
      return { data: [{ ...row }], error: null };
    }
    const matched = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === 'update') {
      matched.forEach((r) => Object.assign(r, this.patch));
      return { data: matched.map((r) => ({ ...r })), error: null };
    }
    return { data: matched.slice(0, this.max).map((r) => ({ ...r })), error: null };
  }
  then<T>(res?: (v: any) => T, rej?: (e: any) => T) { return this.run().then(res, rej); }
}

const NOW = new Date('2026-11-06T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
let db: FakeDb;
let tSeq = 0;

function target(platform: string, format: string, metrics: Row, ageDays: number, extra: Row = {}): Row {
  const n = ++tSeq;
  return {
    id: `t${n}`, post_id: `p${n}`, account_id: `a-${platform}`, platform, format, status: 'published',
    external_url: `https://example.com/${n}`, published_at: daysAgo(ageDays), metrics, ...extra,
  };
}

function seed(targets: Row[]) {
  db = new FakeDb();
  db.tables.social_post_targets = targets;
  db.tables.social_posts = targets.map((t) => ({ id: t.post_id, title: `Post ${t.id}`, caption: `Caption for ${t.id}`, insight_id: t.id === 'twin' ? 'ins1' : null }));
  db.tables.social_accounts = [{ id: 'a-x', handle: 'austin', display_name: 'Austin' }, { id: 'a-instagram', handle: 'qs', display_name: 'QS' }];
  db.tables.content_promotions = [];
  db.tables.content_pieces = [];
}

const client = () => db as any;

beforeEach(() => {
  tSeq = 0;
  idSeq = 0;
  makeAssetMock.mockReset().mockResolvedValue({ piece: { id: 'piece-new', title: 'The longer piece', piece_type: 'reddit_post' }, linkId: 'link1', warnings: [] });
});

describe('channelMedians', () => {
  it('computes a median per platform + format on the first channel metric present', async () => {
    seed([
      // x tweets: replies present → replies is the metric; median of [1,2,3,4,10] = 3
      ...[1, 2, 3, 4, 10].map((r, i) => target('x', 'tweet', { replies: r, likes: 100 }, 10 + i)),
      // instagram carousels: saves; median of [2,4,6,8] = 5 (only 4 → thin)
      ...[2, 4, 6, 8].map((v, i) => target('instagram', 'carousel', { saves: v, likes: 50 }, 20 + i)),
      // old post outside the 90-day baseline
      target('x', 'tweet', { replies: 1000 }, 120),
      // unpublished target ignored
      target('x', 'tweet', { replies: 999 }, 5, { status: 'failed' }),
    ]);
    const medians = await channelMedians(client(), { now: NOW });
    const x = medians.find((m) => m.platform === 'x' && m.format === 'tweet')!;
    expect(x).toMatchObject({ metric: 'replies', count: 5, median: 3 });
    const ig = medians.find((m) => m.platform === 'instagram')!;
    expect(ig).toMatchObject({ metric: 'saves', count: 4, median: null });
  });

  it('falls back to the next metric key and averages the middle pair', async () => {
    seed([1, 2, 3, 4, 5, 6].map((v, i) => target('x', 'tweet', { likes: v }, i + 1)));
    const [m] = await channelMedians(client(), { now: NOW });
    expect(m).toMatchObject({ metric: 'likes', median: 3.5 });
  });
});

describe('findWinners', () => {
  function weekWithWinner() {
    seed([
      ...[2, 2, 3, 3, 4].map((r, i) => target('x', 'tweet', { replies: r }, 20 + i)),
      target('x', 'tweet', { replies: 9 }, 2, { id: 'twin' }),  // 9 ≥ 3 × 3 → winner
      target('x', 'tweet', { replies: 8 }, 3),                  // 8 < 9 → not a winner
      ...[1, 2].map((v, i) => target('instagram', 'reel', { views: v * 1000 }, 1 + i)),
    ]);
  }

  it('flags targets at or above 3x their group median and returns post + account details', async () => {
    weekWithWinner();
    const res = await findWinners(client(), { now: NOW });
    expect(res.winners).toHaveLength(1);
    const w = res.winners[0];
    expect(w).toMatchObject({
      target_id: 'twin', platform: 'x', format: 'tweet', metric: 'replies', value: 9, median: 3, multiple: 3,
      title: 'Post twin', insight_id: 'ins1', account: { id: 'a-x', handle: 'austin' }, promotionExists: false,
    });
    expect(w.external_url).toContain('https://');
    expect(w.suggestions).toEqual(['reddit_post', 'blog', 'x_article', 'youtube_long']);
  });

  it('respects a custom multiple', async () => {
    weekWithWinner();
    const res = await findWinners(client(), { now: NOW, multiple: 2.5 });
    expect(res.winners.map((w) => w.value).sort()).toEqual([8, 9]);
  });

  it('reports thin groups as not enough history instead of flagging them', async () => {
    weekWithWinner();
    const res = await findWinners(client(), { now: NOW });
    expect(res.winners.some((w) => w.platform === 'instagram')).toBe(false);
    expect(res.thinGroups).toEqual([{ platform: 'instagram', format: 'reel', metric: 'views', count: 2, reason: 'not_enough_history' }]);
  });

  it('says so plainly when there is no history at all', async () => {
    seed([]);
    const res = await findWinners(client(), { now: NOW });
    expect(res).toMatchObject({ winners: [], thinGroups: [], medians: [] });
  });

  it('marks winners that already have a promotion', async () => {
    weekWithWinner();
    db.tables.content_promotions.push({ id: 'old', source_kind: 'social_target', source_id: 'twin', proposed_format: 'reddit_post', status: 'accepted', piece_id: 'pc1' });
    const res = await findWinners(client(), { now: NOW });
    expect(res.winners[0].promotionExists).toBe(true);
    expect(res.winners[0].promotions).toEqual([{ id: 'old', proposed_format: 'reddit_post', status: 'accepted', piece_id: 'pc1' }]);
  });
});

describe('suggestFormats', () => {
  it('only offers forms longer than the source', () => {
    const cases: [string, string][] = [['x', 'tweet'], ['instagram', 'reel'], ['instagram', 'trial_reel'], ['instagram', 'carousel'], ['youtube', 'short'], ['reddit', 'post'], ['reddit', 'answer'], ['tiktok', 'tiktok_video']];
    const sourceRank: Record<string, number> = { tweet: FORM_RANK.social_twitter, reel: FORM_RANK.short, trial_reel: FORM_RANK.short, carousel: FORM_RANK.ig_carousel, short: FORM_RANK.short, post: FORM_RANK.reddit_post, answer: FORM_RANK.reddit, tiktok_video: FORM_RANK.short };
    for (const [p, f] of cases) {
      const out = suggestFormats(p, f);
      expect(out.length).toBeGreaterThan(0);
      for (const t of out) expect(FORM_RANK[t]).toBeGreaterThan(sourceRank[f]);
    }
  });

  it('orders per the conversion map', () => {
    expect(suggestFormats('x', 'tweet').slice(0, 3)).toEqual(['reddit_post', 'blog', 'x_article']);
    expect(suggestFormats('instagram', 'reel')).toEqual(['youtube_long', 'blog']);
    expect(suggestFormats('instagram', 'carousel')).toEqual(['blog', 'youtube_long']);
    expect(suggestFormats('youtube', 'short')).toEqual(['youtube_long', 'blog']);
    // A Reddit post is the same length as an X Article, so it is left out.
    expect(suggestFormats('reddit', 'post')).toEqual(['blog', 'youtube_long']);
    expect(suggestFormats('reddit', 'answer')).toEqual(['blog', 'youtube_long', 'x_article']);
    expect(suggestFormats('youtube', 'video')).toEqual([]);
  });
});

describe('promotions', () => {
  it('upserts on source + format without resetting an accepted row', async () => {
    seed([]);
    const a = await proposePromotion(client(), { sourceKind: 'social_target', sourceId: 't1', proposedFormat: 'blog', value: 9, channelMedian: 3 });
    expect(a.created).toBe(true);
    expect(a.promotion).toMatchObject({ status: 'proposed', multiple: 3 });
    const b = await proposePromotion(client(), { sourceKind: 'social_target', sourceId: 't1', proposedFormat: 'blog', value: 12, channelMedian: 3 });
    expect(b.created).toBe(false);
    expect(db.tables.content_promotions).toHaveLength(1);
    expect(db.tables.content_promotions[0]).toMatchObject({ value: 12, multiple: 4 });

    db.tables.content_promotions[0].status = 'accepted';
    const c = await proposePromotion(client(), { sourceKind: 'social_target', sourceId: 't1', proposedFormat: 'blog', value: 99 });
    expect(c.promotion.status).toBe('accepted');
    expect(db.tables.content_promotions[0].value).toBe(12);
  });

  it('accepts a social winner: makeAsset from the post, stores piece_id', async () => {
    seed([target('x', 'tweet', { replies: 9 }, 1, { id: 'tw', post_id: 'post-77' })]);
    const { promotion } = await proposePromotion(client(), {
      sourceKind: 'social_target', sourceId: 'tw', proposedFormat: 'reddit_post', insightId: 'ins9', platform: 'x', metric: 'replies', value: 9, channelMedian: 3,
    });
    const res = await acceptPromotion(client(), promotion.id, { createdBy: 'admin1' });

    expect(makeAssetMock).toHaveBeenCalledTimes(1);
    const [passedClient, args] = makeAssetMock.mock.calls[0];
    expect(passedClient).toBe(db);
    expect(args).toMatchObject({ source: { kind: 'social_post', id: 'post-77' }, target: 'reddit_post', insightId: 'ins9', createdBy: 'admin1' });
    expect(res.piece.id).toBe('piece-new');
    expect(db.tables.content_promotions[0]).toMatchObject({ status: 'accepted', piece_id: 'piece-new' });

    await expect(acceptPromotion(client(), promotion.id)).rejects.toThrow(/already accepted/);
  });

  it('logs an external Reddit winner and accepts it with the pasted text as context', async () => {
    seed([]);
    const { promotion } = await addExternalWinner(client(), {
      url: 'https://www.reddit.com/r/Manifestation/comments/abc/self_image/',
      platform: 'reddit',
      metric: 'upvotes_plus_comments',
      value: 138,
      channelMedian: 20,
      title: 'Your self-image is the ceiling',
      text: 'The whole post body here.',
    });
    expect(promotion).toMatchObject({
      source_kind: 'external', source_id: 'https://www.reddit.com/r/Manifestation/comments/abc/self_image/',
      platform: 'reddit', proposed_format: 'blog', multiple: 6.9, notes: 'The whole post body here.', status: 'proposed',
    });

    makeAssetMock.mockResolvedValueOnce({ piece: { id: 'piece-blog', title: 'Self-image', piece_type: 'blog' }, linkId: null, warnings: ['check sources'] });
    const res = await acceptPromotion(client(), promotion.id, { createdBy: 'admin1' });
    const args = makeAssetMock.mock.calls[0][1];
    expect(args.source).toEqual({ kind: 'external', id: 'https://www.reddit.com/r/Manifestation/comments/abc/self_image/' });
    expect(args.target).toBe('blog');
    expect(args.extraContext).toContain('The whole post body here.');
    expect(args.extraContext).toContain('Your self-image is the ceiling');
    expect(res.warnings).toEqual(['check sources']);
    expect(db.tables.content_promotions[0]).toMatchObject({ status: 'accepted', piece_id: 'piece-blog' });
  });

  it('rejects an external winner without a full url', async () => {
    seed([]);
    await expect(addExternalWinner(client(), { url: 'reddit.com/r/x', platform: 'reddit', metric: 'm', value: 1 })).rejects.toThrow(/https/);
  });

  it('dismiss keeps the pasted text; done only from accepted; sync moves published pieces to done', async () => {
    seed([]);
    const { promotion } = await addExternalWinner(client(), { url: 'https://reddit.com/r/a/1', platform: 'reddit', metric: 'm', value: 50, text: 'body' });
    await expect(markDone(client(), promotion.id)).rejects.toThrow(/Only accepted/);
    const dismissed = await dismissPromotion(client(), promotion.id, 'off-topic');
    expect(dismissed.status).toBe('dismissed');
    expect(dismissed.notes).toBe('body\n\nDismissed: off-topic');

    db.tables.content_promotions.push({ id: 'acc1', status: 'accepted', piece_id: 'pc-pub' }, { id: 'acc2', status: 'accepted', piece_id: 'pc-draft' });
    db.tables.content_pieces.push({ id: 'pc-pub', status: 'published' }, { id: 'pc-draft', status: 'draft' });
    expect(await syncDonePromotions(client())).toBe(1);
    expect(db.tables.content_promotions.find((p) => p.id === 'acc1')!.status).toBe('done');
    expect((await markDone(client(), 'acc2')).status).toBe('done');
  });
});
