/**
 * Social publisher engine. Called by the daily cron (14:00 UTC) and by "publish now".
 * Takes the Supabase client as a parameter so it is testable with an in-memory fake.
 *
 * Concurrency: a pending target is claimed with a conditional update (status pending -> processing); only the
 * run whose update matched a row publishes. Claimed/checked targets get a 10 min lease in next_attempt_at, so a
 * run that dies mid-publish is picked up later through checkStatus instead of publishing twice.
 */
import { ensureFreshToken, loadAccountWithTokens, type Db } from './accounts';
import { getAdapter } from './registry';
import type { PlatformAdapter, PublishResult, SocialPost, SocialPostTarget } from './types';

export const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 5, 15, 60]; // minutes, indexed by attempts-1 (last value reused)
const DEFAULT_PROCESSING_RETRY_SEC = 30;
const LEASE_MS = 10 * 60 * 1000;
const METRICS_MAX_TARGETS = 20;
const METRICS_WINDOW_MS = 14 * 24 * 3600 * 1000;
const METRICS_STALE_MS = 6 * 3600 * 1000;
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

export interface PublisherSummary {
  published: number;
  processing: number;
  failed: number;
  needsAction: number;
  metricsUpdated: number;
}

export interface RunPublisherArgs {
  client: Db;
  now?: Date;
  budgetMs?: number;
  postId?: string;
}

const iso = (d: Date) => d.toISOString();
const addMs = (d: Date, ms: number) => new Date(d.getTime() + ms);

function backoffMs(attempts: number): number {
  const idx = Math.min(Math.max(attempts, 1), BACKOFF_MIN.length) - 1;
  return BACKOFF_MIN[idx] * 60 * 1000;
}

export async function runPublisher({ client, now = new Date(), budgetMs = 240_000, postId }: RunPublisherArgs): Promise<PublisherSummary> {
  const started = Date.now();
  const outOfTime = () => Date.now() - started >= budgetMs;
  const summary: PublisherSummary = { published: 0, processing: 0, failed: 0, needsAction: 0, metricsUpdated: 0 };

  // 1. prune stale OAuth state
  try {
    await client.from('social_oauth_states').delete().lt('created_at', iso(addMs(now, -OAUTH_STATE_TTL_MS)));
  } catch (err) {
    console.warn('[social-publisher] prune oauth states failed:', err instanceof Error ? err.message : err);
  }

  // 2. due posts
  let postQuery = client.from('social_posts').select('*').in('status', ['scheduled', 'publishing']);
  postQuery = postId ? postQuery.eq('id', postId) : postQuery.lte('scheduled_at', iso(now));
  const { data: posts, error: postsErr } = await postQuery.order('scheduled_at', { ascending: true }).limit(50);
  if (postsErr) {
    console.error('[social-publisher] load posts failed:', postsErr.message);
    return summary;
  }

  for (const post of (posts ?? []) as SocialPost[]) {
    if (outOfTime()) break;
    const { data: targets } = await client
      .from('social_post_targets')
      .select('*')
      .eq('post_id', post.id)
      .in('status', ['pending', 'processing']);

    for (const target of (targets ?? []) as SocialPostTarget[]) {
      if (outOfTime()) break;
      const due = !target.next_attempt_at || new Date(target.next_attempt_at).getTime() <= now.getTime();
      if (!due) continue;
      try {
        await processTarget(client, post, target, now, summary);
      } catch (err) {
        console.error('[social-publisher] target crashed:', target.id, err instanceof Error ? err.message : err);
      }
    }
    await rollUpPost(client, post);
  }

  // 3. metrics
  if (!outOfTime()) {
    try {
      summary.metricsUpdated = await syncMetrics(client, now, outOfTime);
    } catch (err) {
      console.warn('[social-publisher] metrics pass failed:', err instanceof Error ? err.message : err);
    }
  }

  return summary;
}

async function processTarget(client: Db, post: SocialPost, target: SocialPostTarget, now: Date, summary: PublisherSummary) {
  let attempts = target.attempts;
  const polling = target.status === 'processing';
  const leaseUntil = iso(addMs(now, LEASE_MS));

  if (target.status === 'pending') {
    // Atomic claim: only one overlapping run gets a row back.
    const { data: claimed } = await client
      .from('social_post_targets')
      .update({ status: 'processing', attempts: target.attempts + 1, next_attempt_at: leaseUntil, error: null, updated_at: iso(now) })
      .eq('id', target.id)
      .eq('status', 'pending')
      .select('id');
    if (!claimed || claimed.length === 0) return;
    attempts = target.attempts + 1;
  } else {
    // processing: take a lease on the check so two runs do not poll at once
    let lease = client
      .from('social_post_targets')
      .update({ next_attempt_at: leaseUntil, updated_at: iso(now) })
      .eq('id', target.id)
      .eq('status', 'processing');
    lease = target.next_attempt_at ? lease.eq('next_attempt_at', target.next_attempt_at) : lease.is('next_attempt_at', null);
    const { data: leased } = await lease.select('id');
    if (!leased || leased.length === 0) return;
  }

  const current: SocialPostTarget = { ...target, status: 'processing', attempts };
  let result: PublishResult;
  try {
    result = await runAdapterStep(client, post, current, now, polling);
  } catch (err) {
    result = { kind: 'failed', error: err instanceof Error ? err.message : String(err), retryable: true };
  }
  await applyResult(client, current, result, now, summary);
}

async function runAdapterStep(client: Db, post: SocialPost, target: SocialPostTarget, now: Date, polling: boolean): Promise<PublishResult> {
  const adapter: PlatformAdapter = getAdapter(target.platform);

  const loaded = await loadAccountWithTokens(client, target.account_id);
  if (!loaded) return { kind: 'failed', error: 'Account no longer exists', retryable: false };
  if (loaded.status !== 'connected') {
    return { kind: 'needs_action', message: `Account is ${loaded.status}. Reconnect it, then retry.` };
  }
  let account;
  try {
    account = await ensureFreshToken(client, loaded, now);
  } catch (err) {
    return { kind: 'needs_action', message: `${err instanceof Error ? err.message : 'Token refresh failed'}. Reconnect the account, then retry.` };
  }

  const ctx = { account, post, target, caption: target.caption_override ?? post.caption };

  if (polling) {
    if (!adapter.checkStatus) return { kind: 'failed', error: 'Publish did not complete and this platform cannot be re-checked', retryable: false };
    return adapter.checkStatus(ctx);
  }

  const problems = adapter.validate(post, target);
  if (problems.length > 0) return { kind: 'failed', error: problems.join('; '), retryable: false };
  return adapter.publish(ctx);
}

async function applyResult(client: Db, target: SocialPostTarget, result: PublishResult, now: Date, summary: PublisherSummary) {
  const patch: Record<string, unknown> = { updated_at: iso(now) };
  const mergedState = (extra?: Record<string, unknown>) => ({ ...(target.state ?? {}), ...(extra ?? {}) });

  switch (result.kind) {
    case 'published':
      Object.assign(patch, {
        status: 'published',
        external_id: result.externalId,
        external_url: result.url ?? null,
        published_at: iso(now),
        state: mergedState(result.state),
        error: null,
        next_attempt_at: null,
      });
      summary.published++;
      break;
    case 'processing':
      Object.assign(patch, {
        status: 'processing',
        state: mergedState(result.state),
        next_attempt_at: iso(addMs(now, (result.retryAfterSec ?? DEFAULT_PROCESSING_RETRY_SEC) * 1000)),
        error: null,
      });
      summary.processing++;
      break;
    case 'needs_action':
      Object.assign(patch, {
        status: 'needs_action',
        error: result.message,
        state: mergedState(result.state),
        next_attempt_at: null,
      });
      summary.needsAction++;
      break;
    case 'failed':
      if (result.state) patch.state = { ...(target.state ?? {}), ...result.state };
      if (result.retryable && target.attempts < MAX_ATTEMPTS) {
        Object.assign(patch, {
          status: 'pending',
          error: result.error,
          next_attempt_at: iso(addMs(now, result.retryAfterSec ? result.retryAfterSec * 1000 : backoffMs(target.attempts))),
        });
      } else {
        Object.assign(patch, { status: 'failed', error: result.error, next_attempt_at: null });
        summary.failed++;
      }
      break;
  }
  await client.from('social_post_targets').update(patch).eq('id', target.id);
}

/** Recompute the post status from its targets; mark the linked content piece published. */
export async function rollUpPost(client: Db, post: SocialPost) {
  const { data } = await client.from('social_post_targets').select('status').eq('post_id', post.id);
  const statuses = ((data ?? []) as { status: string }[]).map((t) => t.status).filter((s) => s !== 'cancelled');
  if (statuses.length === 0) return;

  const published = statuses.filter((s) => s === 'published').length;
  const failed = statuses.filter((s) => s === 'failed').length;
  let next: string;
  if (published === statuses.length) next = 'published';
  else if (published + failed === statuses.length) next = published > 0 ? 'partial' : 'failed';
  else next = 'publishing';

  if (next !== post.status) {
    await client.from('social_posts').update({ status: next, updated_at: new Date().toISOString() }).eq('id', post.id);
  }
  if (post.piece_id && (next === 'published' || next === 'partial')) {
    await client.from('content_pieces').update({ status: 'published' }).eq('id', post.piece_id);
  }
}

async function syncMetrics(client: Db, now: Date, outOfTime: () => boolean): Promise<number> {
  const { data } = await client
    .from('social_post_targets')
    .select('*')
    .eq('status', 'published')
    .gte('published_at', iso(addMs(now, -METRICS_WINDOW_MS)))
    .limit(200);
  const staleBefore = now.getTime() - METRICS_STALE_MS;
  const due = ((data ?? []) as SocialPostTarget[])
    .filter((t) => !t.metrics_synced_at || new Date(t.metrics_synced_at).getTime() < staleBefore)
    .slice(0, METRICS_MAX_TARGETS);

  let updated = 0;
  for (const target of due) {
    if (outOfTime()) break;
    try {
      const adapter = getAdapter(target.platform);
      if (!adapter.fetchMetrics) continue;
      const { data: post } = await client.from('social_posts').select('*').eq('id', target.post_id).maybeSingle();
      const loaded = await loadAccountWithTokens(client, target.account_id);
      if (!post || !loaded || loaded.status !== 'connected') continue;
      const account = await ensureFreshToken(client, loaded, now);
      const metrics = await adapter.fetchMetrics({ account, post: post as SocialPost, target, caption: target.caption_override ?? (post as SocialPost).caption });
      await client.from('social_post_targets').update({ metrics, metrics_synced_at: iso(now) }).eq('id', target.id);
      updated++;
    } catch {
      // metrics are best effort
    }
  }
  return updated;
}
