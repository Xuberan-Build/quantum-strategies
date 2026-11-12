import { randomBytes } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformAdapter, PublishResult } from '../types';

// ---- in-memory fake of the supabase query builder (just what the engine uses)
type Row = Record<string, any>;
class FakeDb {
  tables: Record<string, Row[]> = {};
  from(name: string) {
    this.tables[name] ??= [];
    return new Query(this.tables[name]);
  }
}
class Query implements PromiseLike<any> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'update' | 'delete' = 'select';
  private patch: Row = {};
  private max = Infinity;
  private returning = false;
  constructor(private rows: Row[]) {}
  select(_cols?: string) { if (this.op === 'select') this.op = 'select'; else this.returning = true; return this; }
  update(p: Row) { this.op = 'update'; this.patch = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: null) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] <= v); return this; }
  lt(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] < v); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { return this.run().then((r) => ({ data: r.data?.[0] ?? null, error: null })); }
  single() { return this.maybeSingle(); }
  private async run() {
    const matched = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === 'update') {
      matched.forEach((r) => Object.assign(r, this.patch));
      return { data: this.returning ? matched.map((r) => ({ ...r })) : null, error: null };
    }
    if (this.op === 'delete') {
      for (const r of matched) this.rows.splice(this.rows.indexOf(r), 1);
      return { data: null, error: null };
    }
    return { data: matched.slice(0, this.max).map((r) => ({ ...r })), error: null };
  }
  then<T>(res?: (v: any) => T, rej?: (e: any) => T) { return this.run().then(res, rej); }
}

// ---- mocked adapter registry
const adapter = {
  platform: 'x', label: 'X', formats: ['tweet'], usesPkce: false, requiredEnv: [],
  getAuthUrl: vi.fn(), exchangeCode: vi.fn(),
  validate: vi.fn<any>(() => []),
  publish: vi.fn<any>(),
  checkStatus: vi.fn<any>(),
  fetchMetrics: vi.fn<any>(),
} as unknown as PlatformAdapter & Record<string, any>;
vi.mock('../registry', () => ({ getAdapter: () => adapter }));

import { encryptToken } from '../crypto';
import { runPublisher } from '../engine';

const NOW = new Date('2026-11-01T12:00:00.000Z');
let db: FakeDb;

function seed(opts: { targets?: Row[]; piece?: boolean; postExtra?: Row } = {}) {
  db = new FakeDb();
  db.tables.social_accounts = [
    { id: 'a1', platform: 'x', external_id: 'x1', status: 'connected', access_token_enc: encryptToken('tok'), refresh_token_enc: null, token_expires_at: null, scopes: [], meta: {} },
    { id: 'a2', platform: 'x', external_id: 'x2', status: 'connected', access_token_enc: encryptToken('tok2'), refresh_token_enc: null, token_expires_at: null, scopes: [], meta: {} },
  ];
  db.tables.social_posts = [{
    id: 'p1', piece_id: opts.piece ? 'piece1' : null, caption: 'hello', media: [], tags: [], status: 'scheduled',
    scheduled_at: '2026-11-01T11:00:00.000Z', ...opts.postExtra,
  }];
  db.tables.social_post_targets = (opts.targets ?? [{}]).map((t, i) => ({
    id: `t${i + 1}`, post_id: 'p1', account_id: i === 1 ? 'a2' : 'a1', platform: 'x', format: 'tweet',
    caption_override: null, options: {}, status: 'pending', state: {}, attempts: 0, next_attempt_at: null, metrics: {}, metrics_synced_at: null, ...t,
  }));
  db.tables.content_pieces = [{ id: 'piece1', status: 'approved' }];
  db.tables.social_oauth_states = [];
}
const run = (extra: Record<string, any> = {}) => runPublisher({ client: db as any, now: NOW, budgetMs: 60_000, ...extra });
const target = (id: string) => db.tables.social_post_targets.find((t) => t.id === id)!;
const post = () => db.tables.social_posts[0];

beforeEach(() => {
  process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString('base64');
  // re-encrypt seeds lazily: seed() runs after env is set
  adapter.validate.mockReset().mockReturnValue([]);
  adapter.publish.mockReset();
  adapter.checkStatus.mockReset();
  adapter.fetchMetrics.mockReset();
  seed();
});

describe('runPublisher', () => {
  it('publishes a due target and rolls the post up to published', async () => {
    adapter.publish.mockResolvedValue({ kind: 'published', externalId: 'ext1', url: 'https://x.com/1' } as PublishResult);
    const summary = await run();
    expect(summary.published).toBe(1);
    expect(target('t1')).toMatchObject({ status: 'published', external_id: 'ext1', external_url: 'https://x.com/1', attempts: 1 });
    expect(target('t1').published_at).toBe(NOW.toISOString());
    expect(post().status).toBe('published');
    expect(adapter.publish.mock.calls[0][0].account.accessToken).toBe('tok');
    expect(adapter.publish.mock.calls[0][0].caption).toBe('hello');
  });

  it('never double publishes when two runs overlap', async () => {
    let release!: () => void;
    adapter.publish.mockImplementation(() => new Promise((res) => { release = () => res({ kind: 'published', externalId: 'e' }); }));
    const first = run();
    await new Promise((r) => setTimeout(r, 20));
    const second = await run(); // first is mid-publish, target is claimed
    expect(second.published).toBe(0);
    release();
    await first;
    expect(adapter.publish).toHaveBeenCalledTimes(1);
  });

  it('skips targets whose next_attempt_at is in the future and posts not yet due', async () => {
    seed({ targets: [{ next_attempt_at: '2026-11-01T12:30:00.000Z' }] });
    await run();
    expect(adapter.publish).not.toHaveBeenCalled();
    seed({ postExtra: { scheduled_at: '2026-11-01T13:00:00.000Z' } });
    await run();
    expect(adapter.publish).not.toHaveBeenCalled();
    // ...but an explicit postId ignores scheduled_at
    adapter.publish.mockResolvedValue({ kind: 'published', externalId: 'e' });
    await run({ postId: 'p1' });
    expect(adapter.publish).toHaveBeenCalledTimes(1);
  });

  it('processing then checkStatus then published', async () => {
    adapter.publish.mockResolvedValue({ kind: 'processing', state: { container: 'c1' }, retryAfterSec: 120 });
    const s1 = await run();
    expect(s1.processing).toBe(1);
    expect(target('t1')).toMatchObject({ status: 'processing', state: { container: 'c1' }, next_attempt_at: '2026-11-01T12:02:00.000Z' });
    expect(post().status).toBe('publishing');

    // not due yet
    await run();
    expect(adapter.checkStatus).not.toHaveBeenCalled();

    const later = new Date(NOW.getTime() + 3 * 60_000);
    adapter.checkStatus.mockResolvedValue({ kind: 'published', externalId: 'ig9', url: 'https://ig/9' });
    const s2 = await runPublisher({ client: db as any, now: later, budgetMs: 60_000 });
    expect(s2.published).toBe(1);
    expect(adapter.publish).toHaveBeenCalledTimes(1);
    expect(adapter.checkStatus.mock.calls[0][0].target.state).toEqual({ container: 'c1' });
    expect(target('t1')).toMatchObject({ status: 'published', external_id: 'ig9' });
    expect(post().status).toBe('published');
  });

  it('fails a processing target when the adapter has no checkStatus', async () => {
    seed({ targets: [{ status: 'processing', attempts: 1, next_attempt_at: '2026-11-01T11:50:00.000Z' }] });
    const saved = adapter.checkStatus;
    delete (adapter as any).checkStatus;
    await run();
    (adapter as any).checkStatus = saved;
    expect(target('t1')).toMatchObject({ status: 'failed' });
    expect(post().status).toBe('failed');
  });

  it('retries retryable failures with exponential backoff', async () => {
    adapter.publish.mockResolvedValue({ kind: 'failed', error: 'boom', retryable: true });
    await run();
    expect(target('t1')).toMatchObject({ status: 'pending', attempts: 1, error: 'boom', next_attempt_at: '2026-11-01T12:01:00.000Z' });
    expect(post().status).toBe('publishing');

    let t = new Date(NOW.getTime() + 61_000);
    await runPublisher({ client: db as any, now: t, budgetMs: 60_000 });
    expect(target('t1')).toMatchObject({ status: 'pending', attempts: 2, next_attempt_at: new Date(t.getTime() + 5 * 60_000).toISOString() });

    t = new Date(t.getTime() + 6 * 60_000);
    await runPublisher({ client: db as any, now: t, budgetMs: 60_000 });
    expect(target('t1').next_attempt_at).toBe(new Date(t.getTime() + 15 * 60_000).toISOString());
  });

  it('honours retryAfterSec on failures', async () => {
    adapter.publish.mockResolvedValue({ kind: 'failed', error: 'rate', retryable: true, retryAfterSec: 900 });
    await run();
    expect(target('t1').next_attempt_at).toBe('2026-11-01T12:15:00.000Z');
  });

  it('turns a thrown adapter error into a retryable failure', async () => {
    adapter.publish.mockRejectedValue(new Error('network down'));
    await run();
    expect(target('t1')).toMatchObject({ status: 'pending', error: 'network down' });
  });

  it('gives up after 5 attempts', async () => {
    seed({ targets: [{ attempts: 4 }] });
    adapter.publish.mockResolvedValue({ kind: 'failed', error: 'still broken', retryable: true });
    const s = await run();
    expect(s.failed).toBe(1);
    expect(target('t1')).toMatchObject({ status: 'failed', attempts: 5, error: 'still broken' });
    expect(post().status).toBe('failed');
  });

  it('fails validation problems without retrying or publishing', async () => {
    adapter.validate.mockReturnValue(['needs a video', 'too long']);
    await run();
    expect(adapter.publish).not.toHaveBeenCalled();
    expect(target('t1')).toMatchObject({ status: 'failed', error: 'needs a video; too long' });
  });

  it('marks needs_action and keeps the post publishing', async () => {
    adapter.publish.mockResolvedValue({ kind: 'needs_action', message: 'Finish in the TikTok inbox' });
    const s = await run();
    expect(s.needsAction).toBe(1);
    expect(target('t1')).toMatchObject({ status: 'needs_action', error: 'Finish in the TikTok inbox' });
    expect(post().status).toBe('publishing');
  });

  it('needs_action when the account is not connected', async () => {
    db.tables.social_accounts[0].status = 'expired';
    await run();
    expect(adapter.publish).not.toHaveBeenCalled();
    expect(target('t1').status).toBe('needs_action');
  });

  it('rolls up to partial and marks the content piece published', async () => {
    seed({ piece: true, targets: [{}, {}] });
    adapter.publish
      .mockResolvedValueOnce({ kind: 'published', externalId: 'ok' })
      .mockResolvedValueOnce({ kind: 'failed', error: 'nope', retryable: false });
    const s = await run();
    expect(s).toMatchObject({ published: 1, failed: 1 });
    expect(post().status).toBe('partial');
    expect(db.tables.content_pieces[0].status).toBe('published');
  });

  it('does not touch the piece while a post is still publishing', async () => {
    seed({ piece: true });
    adapter.publish.mockResolvedValue({ kind: 'processing', state: {} });
    await run();
    expect(db.tables.content_pieces[0].status).toBe('approved');
  });

  it('prunes old oauth states', async () => {
    db.tables.social_oauth_states = [
      { state: 'old', created_at: '2026-11-01T11:00:00.000Z' },
      { state: 'new', created_at: '2026-11-01T11:55:00.000Z' },
    ];
    await run();
    expect(db.tables.social_oauth_states.map((s) => s.state)).toEqual(['new']);
  });

  it('syncs metrics for stale published targets and ignores errors', async () => {
    seed({
      postExtra: { status: 'published' },
      targets: [
        { status: 'published', published_at: '2026-10-30T00:00:00.000Z', metrics_synced_at: null },
        { status: 'published', published_at: '2026-10-30T00:00:00.000Z', metrics_synced_at: '2026-11-01T11:00:00.000Z' },
        { status: 'published', published_at: '2026-09-01T00:00:00.000Z', metrics_synced_at: null },
      ],
    });
    db.tables.social_post_targets[2].account_id = 'a1';
    adapter.fetchMetrics.mockResolvedValue({ views: 42 });
    const s = await run();
    expect(s.metricsUpdated).toBe(1);
    expect(target('t1')).toMatchObject({ metrics: { views: 42 }, metrics_synced_at: NOW.toISOString() });

    adapter.fetchMetrics.mockRejectedValue(new Error('api down'));
    target('t1').metrics_synced_at = null;
    await expect(run()).resolves.toMatchObject({ metricsUpdated: 0 });
  });

  it('stops starting work when the budget is spent', async () => {
    adapter.publish.mockResolvedValue({ kind: 'published', externalId: 'e' });
    const s = await run({ budgetMs: 0 });
    expect(s.published).toBe(0);
    expect(adapter.publish).not.toHaveBeenCalled();
  });
});
