/**
 * The daily progress-email run: load → decide → claim → render → deliver.
 *
 * PROGRESS_EMAIL_MODE (default off):
 *   off      nothing happens
 *   preview  renders every email that would go out today to files; claims nothing,
 *            so switching to send later doesn't skip anyone
 *   send     claims, sends, records; a failed send releases its claim to retry tomorrow
 */
import { BUSINESS } from '../../../config/business.config';
import { APP_URL } from '@/lib/config/urls';
import { deliverReadEmail, type OutgoingReadEmail, type ReadEmailOutcome } from '@/lib/read/email-transport';
import { optOutOneClickUrl } from './links';
import { decideFounderAlert, decideUserEmail, type ProgressEmailKind } from './schedule';
import { renderFounderDigest, renderProgressEmail, type TemplateContext } from './templates';
import { createSupabaseProgressStore, type Candidate, type ProgressEmailStore } from './store';
import { errorMessage } from '@/lib/errors';

export type ProgressEmailMode = 'off' | 'preview' | 'send';

export function getProgressEmailMode(env: Record<string, string | undefined> = process.env): ProgressEmailMode {
  const m = env.PROGRESS_EMAIL_MODE?.trim().toLowerCase();
  return m === 'preview' || m === 'send' ? m : 'off';
}

export interface RunDeps {
  mode: ProgressEmailMode;
  now: Date;
  store: ProgressEmailStore;
  deliver: (msg: OutgoingReadEmail, mode: 'preview' | 'send') => Promise<ReadEmailOutcome>;
  ctx: TemplateContext;
  /** Where "people to call" goes. No address, no digest. */
  founderEmail: string | null;
}

export interface RunResult {
  mode: ProgressEmailMode;
  considered: number;
  emails: Partial<Record<ProgressEmailKind, number>>;
  alerted: number;
  alreadyClaimed: number;
  errors: string[];
}

export function defaultDeps(now = new Date()): RunDeps {
  return {
    mode: getProgressEmailMode(),
    now,
    store: createSupabaseProgressStore({ teamEmails: BUSINESS.adminEmails }),
    deliver: (msg, mode) => deliverReadEmail(msg, { mode }),
    ctx: {
      appUrl: APP_URL,
      businessName: BUSINESS.name && BUSINESS.name !== 'Your Business' ? BUSINESS.name : 'Quantum Strategies',
      founderName: 'Austin',
      postalAddress: process.env.BUSINESS_POSTAL_ADDRESS?.trim() || undefined,
    },
    founderEmail: process.env.FOUNDER_ALERT_EMAIL?.trim() || BUSINESS.adminEmails[0] || null,
  };
}

export async function runProgressEmails(deps: RunDeps = defaultDeps()): Promise<RunResult> {
  const { mode, now, store, deliver, ctx } = deps;
  const result: RunResult = { mode, considered: 0, emails: {}, alerted: 0, alreadyClaimed: 0, errors: [] };
  if (mode === 'off') return result;

  const candidates = await store.loadCandidates(now);
  result.considered = candidates.length;
  const toCall: { c: Candidate; key: string }[] = [];

  for (const c of candidates) {
    const { snapshot: s, history } = c;
    const alert = decideFounderAlert(s, history);
    if (alert) toCall.push({ c, key: alert.key });

    const d = decideUserEmail(s, history, now);
    if (!d) continue;
    try {
      if (mode === 'send' && !(await store.claim(s.user.id, d.key, d.kind, mode))) {
        result.alreadyClaimed++;
        continue;
      }
      const email = renderProgressEmail(d, s, ctx);
      const outcome = await deliver(
        { to: s.user.email, ...email, kind: `progress-${d.kind}`, listUnsubscribeUrl: optOutOneClickUrl(ctx.appUrl, { userId: s.user.id, topic: 'progress' }) },
        mode,
      );
      if (!outcome.ok) throw new Error(outcome.error ?? 'delivery failed');
      if (mode === 'send') await store.markSent(s.user.id, d.key);
      result.emails[d.kind] = (result.emails[d.kind] ?? 0) + 1;
    } catch (err) {
      result.errors.push(`${s.user.id} ${d.key}: ${errorMessage(err)}`);
      if (mode === 'send') await store.release(s.user.id, d.key, errorMessage(err)).catch(() => {});
    }
  }

  if (toCall.length && deps.founderEmail) await sendFounderDigest(toCall, deps, result);
  return result;
}

async function sendFounderDigest(toCall: { c: Candidate; key: string }[], deps: RunDeps, result: RunResult) {
  const { mode, store, deliver, ctx } = deps;
  const claimed: typeof toCall = [];
  for (const t of toCall) {
    if (mode !== 'send' || (await store.claim(t.c.snapshot.user.id, t.key, 'founder-alert', mode))) claimed.push(t);
    else result.alreadyClaimed++;
  }
  if (!claimed.length) return;

  const digest = renderFounderDigest(
    claimed.map((t) => t.c.snapshot),
    ctx,
  );
  const outcome = await deliver({ to: deps.founderEmail!, ...digest, kind: 'progress-founder-digest' }, mode as 'preview' | 'send');

  for (const t of claimed) {
    const userId = t.c.snapshot.user.id;
    if (mode !== 'send') continue;
    if (outcome.ok) await store.markSent(userId, t.key);
    else await store.release(userId, t.key, outcome.error ?? 'digest failed').catch(() => {});
  }
  if (outcome.ok) result.alerted = claimed.length;
  else result.errors.push(`founder digest: ${outcome.error}`);
}
