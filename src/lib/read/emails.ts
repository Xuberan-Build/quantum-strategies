/**
 * The Perception Read: emails. Server-only.
 *
 *   sendReadResultEmail   R1, transactional, at unlock. Everyone who gave an email,
 *                         except the crisis tier (no pattern). Never throws.
 *   scheduleReadFollowups records what day 2 and day 7 need. The cron
 *                         (/api/cron/read-followups) sends them to consented leads.
 *   onReadUnlocked        both of the above, for /api/read/unlock. Never throws.
 *   runReadFollowups      the cron's logic: due leads, idempotent, consent and
 *                         unsubscribe respected, newest lead per email only.
 *
 * Sending failures are logged, recorded as read_email_failed and returned. They
 * never block the unlock response. See email-transport.ts for preview mode.
 */

import { APP_URL } from '@/lib/config/urls';
import { BUSINESS } from '../../../config/business.config';
import { renderReadResultEmail } from '@/lib/email/templates/read-result';
import { renderReadDay2Email } from '@/lib/email/templates/read-day2';
import { renderReadDay7Email } from '@/lib/email/templates/read-day7';
import { READ_PATTERN_COPY, toPlain, type RenderedReadEmail } from '@/lib/email/templates/read-shared';
import { answerPageUrl, readCheckoutUrl, unsubscribeOneClickUrl, unsubscribePageUrl } from './email-links';
import { deliverReadEmail, type ReadEmailOutcome } from './email-transport';
import {
  supabaseFollowupStore,
  type FollowupContext,
  type FollowupStore,
  type ReadEmailKindId,
  type ReadLeadRow,
} from './email-store';
import type { PatternId, ReadAnswers, ReadResult, WeekMirror } from './types';

const PATTERN_IDS = Object.keys(READ_PATTERN_COPY) as PatternId[];

function isPattern(value: unknown): value is PatternId {
  return typeof value === 'string' && (PATTERN_IDS as string[]).includes(value);
}

function businessName(): string {
  return BUSINESS.name && BUSINESS.name !== 'Your Business' ? BUSINESS.name : 'Quantum Strategies';
}

function replyEmail(): string | undefined {
  const e = BUSINESS.sender.email;
  return e && e !== 'noreply@example.com' && !e.startsWith('noreply@') ? e : undefined;
}

// ── Lead shape: accept the store row or the camelCase input ──────────────

export interface ReadLeadForEmail {
  id: string;
  email: string;
  consentMarketing?: boolean;
  consent_marketing?: boolean | null;
  sessionId?: string | null;
  session_id?: string | null;
  userId?: string | null;
  user_id?: string | null;
}

function leadConsent(lead: ReadLeadForEmail): boolean {
  return Boolean(lead.consentMarketing ?? lead.consent_marketing);
}

// ── Pull the email's pieces out of a ReadResult ──────────────────────────

export interface ResultEmailParts {
  pattern: PatternId;
  patternName: string;
  patternRead: string;
  mirrorLines: string[];
  move: string | null;
  watch: string | null;
  scanName: string | null;
  priceUsd: number | null;
}

/** Defensive: the result blocks are built by another module; anything missing falls back. */
export function extractResultParts(
  result: ReadResult,
  extra: { mirror?: WeekMirror | null; patternRead?: string | null } = {},
): ResultEmailParts | null {
  if (!isPattern(result.pattern)) return null;
  const canonical = READ_PATTERN_COPY[result.pattern];
  const block = (id: string) => result.blocks.find((b) => b.id === id);

  const patternName = toPlain(result.patternName) || canonical.name;

  let patternRead = toPlain(extra.patternRead);
  if (!patternRead) {
    // A segment wording (different name) carries its own read in the pattern block.
    const fromBlock = toPlain(block('pattern')?.body);
    patternRead = patternName !== canonical.name && fromBlock && fromBlock.length <= 240 ? fromBlock : canonical.read;
  }

  let mirrorLines: string[] = [];
  const mirrorBody = toPlain(block('mirror')?.body);
  if (mirrorBody) mirrorLines = mirrorBody.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 3);
  else if (extra.mirror?.line) mirrorLines = [toPlain(extra.mirror.line)];

  const moveBlock = block('move');
  const move = toPlain(moveBlock?.body) || null;
  const watchMeta = moveBlock?.meta?.watch;
  const watch = typeof watchMeta === 'string' ? toPlain(watchMeta) || null : null;

  return {
    pattern: result.pattern,
    patternName,
    patternRead,
    mirrorLines,
    move,
    watch,
    scanName: result.offer?.scanName ?? null,
    priceUsd: result.offer?.priceUsd ?? null,
  };
}

/** Q10 baseline and nothing else from the answers. */
export function baselineFromAnswers(answers?: ReadAnswers | null): number | null {
  const n = answers?.q10?.number;
  return typeof n === 'number' && n >= 1 && n <= 10 ? n : null;
}

// ── R1 ────────────────────────────────────────────────────────────────────

export interface SendReadResultEmailInput {
  lead: ReadLeadForEmail;
  result: ReadResult;
  /** Absolute signed link to the full result (store.ts). */
  resultUrl: string;
  mirror?: WeekMirror | null;
  patternRead?: string | null;
  appUrl?: string;
}

export interface ReadResultEmailOutcome extends Partial<ReadEmailOutcome> {
  ok: boolean;
  skipped?: 'crisis' | 'already_sent' | 'no_email';
  error?: string;
}

export interface R1Deps {
  store?: Pick<FollowupStore, 'claim' | 'markSent' | 'release' | 'logEvent'>;
  deliver?: typeof deliverReadEmail;
}

export function buildReadResultEmail(input: SendReadResultEmailInput): RenderedReadEmail | null {
  const parts = extractResultParts(input.result, { mirror: input.mirror, patternRead: input.patternRead });
  if (!parts) return null;
  const appUrl = input.appUrl ?? APP_URL;
  const sessionId = input.result.sessionId;
  return renderReadResultEmail({
    pattern: parts.pattern,
    patternName: parts.patternName,
    patternRead: parts.patternRead,
    mirrorLines: parts.mirrorLines,
    move: parts.move,
    watch: parts.watch,
    resultUrl: input.resultUrl,
    offer:
      input.result.offer && parts.scanName
        ? { scanName: parts.scanName, priceUsd: input.result.offer.priceUsd, checkoutUrl: readCheckoutUrl(appUrl, sessionId) }
        : null,
    consentMarketing: leadConsent(input.lead),
    unsubscribeUrl: unsubscribePageUrl(appUrl, input.lead.id),
    founderName: 'Austin',
    businessName: businessName(),
    replyEmail: replyEmail(),
  });
}

function leadRowFrom(lead: ReadLeadForEmail, sessionId: string): ReadLeadRow {
  return {
    id: lead.id,
    email: lead.email,
    consent_marketing: leadConsent(lead),
    session_id: lead.sessionId ?? lead.session_id ?? sessionId,
    pattern: null,
    user_id: lead.userId ?? lead.user_id ?? null,
    unsubscribed_at: null,
    created_at: new Date().toISOString(),
  };
}

/** Sends R1 once per lead. Never throws. */
export async function sendReadResultEmail(input: SendReadResultEmailInput, deps: R1Deps = {}): Promise<ReadResultEmailOutcome> {
  const store = deps.store ?? supabaseFollowupStore;
  const deliver = deps.deliver ?? deliverReadEmail;
  try {
    if (!input.lead?.email) return { ok: false, skipped: 'no_email' };
    const email = buildReadResultEmail(input);
    if (!email) return { ok: false, skipped: 'crisis' };

    const lead = leadRowFrom(input.lead, input.result.sessionId);
    const marker = await store.claim(lead, 'r1');
    if (!marker) return { ok: false, skipped: 'already_sent' };

    const appUrl = input.appUrl ?? APP_URL;
    const outcome = await deliver({
      to: input.lead.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      kind: 'r1',
      listUnsubscribeUrl: unsubscribeOneClickUrl(appUrl, input.lead.id),
    });
    await recordOutcome(store, lead, 'r1', marker, outcome);
    return outcome;
  } catch (err: any) {
    console.error('[read-email] R1 failed:', err?.message);
    return { ok: false, error: err?.message ?? 'R1 failed' };
  }
}

async function recordOutcome(
  store: Pick<FollowupStore, 'markSent' | 'release' | 'logEvent'>,
  lead: ReadLeadRow,
  kind: ReadEmailKindId,
  marker: string,
  outcome: ReadEmailOutcome,
): Promise<void> {
  if (outcome.ok) {
    await store.markSent(marker, kind, { mode: outcome.mode, transport: outcome.transport ?? null });
    return;
  }
  await store.release(marker);
  await store
    .logEvent({
      sessionId: lead.session_id,
      leadId: lead.id,
      userId: lead.user_id,
      event: 'read_email_failed',
      props: { email: kind, mode: outcome.mode, error: (outcome.error ?? 'unknown').slice(0, 300) },
    })
    .catch((err) => console.warn('[read-email] failure event not logged:', err?.message));
}

// ── Scheduling ────────────────────────────────────────────────────────────

export interface ScheduleReadFollowupsInput {
  leadId: string;
  sessionId: string;
  pattern: PatternId | null;
  result?: ReadResult;
  resultUrl?: string;
  answers?: ReadAnswers | null;
  userId?: string | null;
}

/**
 * Records the follow-up context on the lead. Sending is the cron's job, and it only
 * sends to leads with marketing consent. Never throws.
 */
export async function scheduleReadFollowups(
  input: ScheduleReadFollowupsInput,
  deps: { store?: Pick<FollowupStore, 'logEvent'> } = {},
): Promise<{ ok: boolean; error?: string }> {
  const store = deps.store ?? supabaseFollowupStore;
  try {
    if (!isPattern(input.pattern)) return { ok: false, error: 'no pattern (crisis tier or missing)' };
    const parts = input.result ? extractResultParts(input.result) : null;
    const context: FollowupContext = {
      pattern: input.pattern,
      patternName: parts?.patternName ?? null,
      move: parts?.move ?? null,
      watch: parts?.watch ?? null,
      baseline: baselineFromAnswers(input.answers),
      resultUrl: input.resultUrl ?? null,
    };
    await store.logEvent({
      sessionId: input.sessionId,
      leadId: input.leadId,
      userId: input.userId ?? null,
      event: 'read_followups_scheduled',
      props: context as unknown as Record<string, unknown>,
    });
    return { ok: true };
  } catch (err: any) {
    console.error('[read-email] scheduling follow-ups failed:', err?.message);
    return { ok: false, error: err?.message };
  }
}

export interface OnReadUnlockedInput extends SendReadResultEmailInput {
  answers?: ReadAnswers | null;
}

/**
 * For /api/read/unlock, after the lead row exists. Await it inside `after()` (next/server)
 * so the response isn't held up. Never throws.
 */
export async function onReadUnlocked(input: OnReadUnlockedInput) {
  const [r1, followups] = await Promise.all([
    sendReadResultEmail(input),
    scheduleReadFollowups({
      leadId: input.lead.id,
      sessionId: input.result.sessionId,
      pattern: input.result.pattern,
      result: input.result,
      resultUrl: input.resultUrl,
      answers: input.answers,
      userId: input.lead.userId ?? input.lead.user_id ?? null,
    }),
  ]);
  return { r1, followups };
}

// ── The cron ──────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

/** Due windows by lead age. Older than the window means we missed it: don't send late. */
export const FOLLOWUP_WINDOWS: Record<'day2' | 'day7', { minDays: number; maxDays: number }> = {
  day2: { minDays: 2, maxDays: 5 },
  day7: { minDays: 7, maxDays: 10 },
};

export interface FollowupRunResult {
  considered: number;
  sent: number;
  skipped: { already: number; superseded: number; noContext: number; claimedElsewhere: number };
  failed: number;
  errors: string[];
}

export interface FollowupDeps {
  store?: FollowupStore;
  deliver?: typeof deliverReadEmail;
  now?: Date;
  appUrl?: string;
}

export function renderFollowup(
  kind: 'day2' | 'day7',
  lead: ReadLeadRow,
  ctx: FollowupContext | undefined,
  appUrl: string,
  now: number,
): RenderedReadEmail | null {
  const pattern = ctx?.pattern ?? lead.pattern;
  if (!isPattern(pattern)) return null;
  const resultUrl = ctx?.resultUrl || new URL('/read/', appUrl).toString();
  const common = {
    pattern,
    patternName: ctx?.patternName ?? null,
    resultUrl,
    unsubscribeUrl: unsubscribePageUrl(appUrl, lead.id),
    founderName: 'Austin',
    businessName: businessName(),
  };
  if (kind === 'day2') return renderReadDay2Email({ ...common, move: ctx?.move ?? null, watch: ctx?.watch ?? null });
  return renderReadDay7Email({
    ...common,
    baseline: ctx?.baseline ?? null,
    answerUrl: (q, v) => answerPageUrl(appUrl, lead.id, q, v, now),
  });
}

export async function runReadFollowups(deps: FollowupDeps = {}): Promise<FollowupRunResult> {
  const store = deps.store ?? supabaseFollowupStore;
  const deliver = deps.deliver ?? deliverReadEmail;
  const now = deps.now ?? new Date();
  const appUrl = deps.appUrl ?? APP_URL;
  const result: FollowupRunResult = {
    considered: 0,
    sent: 0,
    skipped: { already: 0, superseded: 0, noContext: 0, claimedElsewhere: 0 },
    failed: 0,
    errors: [],
  };

  for (const kind of ['day2', 'day7'] as const) {
    const w = FOLLOWUP_WINDOWS[kind];
    const from = new Date(now.getTime() - w.maxDays * DAY);
    const to = new Date(now.getTime() - w.minDays * DAY);

    let candidates: ReadLeadRow[];
    try {
      candidates = await store.listCandidates(from, to);
    } catch (err: any) {
      result.errors.push(`${kind}: ${err?.message}`);
      continue;
    }
    // Belt and braces: the query filters these too.
    candidates = candidates.filter((l) => l.consent_marketing === true && !l.unsubscribed_at && l.email);
    if (candidates.length === 0) continue;

    // Someone who took the Read twice gets one series, from their newest lead.
    const all = await store.listLeadsByEmails(Array.from(new Set(candidates.map((l) => l.email))));
    const newest = new Map<string, { id: string; created_at: string }>();
    for (const l of [...all, ...candidates]) {
      const key = l.email.trim().toLowerCase();
      const cur = newest.get(key);
      if (!cur || l.created_at > cur.created_at) newest.set(key, { id: l.id, created_at: l.created_at });
    }

    const ids = candidates.map((l) => l.id);
    const [sent, contexts] = await Promise.all([store.sentKeys(ids), store.contexts(ids)]);

    for (const lead of candidates) {
      result.considered++;
      if (newest.get(lead.email.trim().toLowerCase())?.id !== lead.id) {
        result.skipped.superseded++;
        continue;
      }
      if (sent.has(`${lead.id}:${kind}`)) {
        result.skipped.already++;
        continue;
      }
      const email = renderFollowup(kind, lead, contexts.get(lead.id), appUrl, now.getTime());
      if (!email) {
        result.skipped.noContext++;
        continue;
      }

      let marker: string | null;
      try {
        marker = await store.claim(lead, kind);
      } catch (err: any) {
        result.failed++;
        result.errors.push(`${kind} ${lead.id}: ${err?.message}`);
        continue;
      }
      if (!marker) {
        result.skipped.claimedElsewhere++;
        continue;
      }

      const outcome = await deliver({
        to: lead.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        kind,
        listUnsubscribeUrl: unsubscribeOneClickUrl(appUrl, lead.id),
      });
      try {
        await recordOutcome(store, lead, kind, marker, outcome);
      } catch (err: any) {
        result.errors.push(`${kind} ${lead.id} record: ${err?.message}`);
      }
      if (outcome.ok) result.sent++;
      else {
        result.failed++;
        result.errors.push(`${kind} ${lead.id}: ${outcome.error ?? 'send failed'}`);
      }
    }
  }
  return result;
}
