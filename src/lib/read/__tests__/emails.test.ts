import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));

import {
  extractResultParts,
  runReadFollowups,
  scheduleReadFollowups,
  sendReadResultEmail,
  FOLLOWUP_WINDOWS,
} from '../emails';
import type { FollowupContext, FollowupStore, ReadEmailKindId, ReadEventInput, ReadLeadRow } from '../email-store';
import type { OutgoingReadEmail, ReadEmailOutcome } from '../email-transport';
import { verifyReadLink } from '../email-links';
import { APP, LEAD_ID, SESSION_ID, shouldsResult } from './email-fixtures';

beforeAll(() => {
  process.env.READ_LINK_SECRET = 'test-secret';
});

const DAY = 86400000;
const NOW = new Date('2026-10-20T15:00:00Z');

/** In-memory FollowupStore with the same claim semantics as the Supabase one. */
class MemoryStore implements FollowupStore {
  leads: ReadLeadRow[] = [];
  markers: { id: string; lead_id: string; kind: ReadEmailKindId; status: string; created_at: string }[] = [];
  ctx = new Map<string, FollowupContext>();
  events: ReadEventInput[] = [];
  private seq = 0;

  async listCandidates(from: Date, to: Date) {
    return this.leads.filter(
      (l) =>
        l.consent_marketing === true &&
        !l.unsubscribed_at &&
        l.pattern &&
        l.created_at >= from.toISOString() &&
        l.created_at < to.toISOString(),
    );
  }
  async listLeadsByEmails(emails: string[]) {
    return this.leads.filter((l) => emails.includes(l.email));
  }
  async sentKeys(ids: string[]) {
    return new Set(this.markers.filter((m) => ids.includes(m.lead_id)).map((m) => `${m.lead_id}:${m.kind}`));
  }
  async contexts(ids: string[]) {
    return new Map([...this.ctx].filter(([k]) => ids.includes(k)));
  }
  async claim(lead: ReadLeadRow, kind: ReadEmailKindId) {
    const id = `m${++this.seq}`;
    this.markers.push({ id, lead_id: lead.id, kind, status: 'claimed', created_at: new Date(1000 + this.seq).toISOString() });
    const mine = this.markers.filter((m) => m.lead_id === lead.id && m.kind === kind).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (mine[0].id !== id) {
      this.markers = this.markers.filter((m) => m.id !== id);
      return null;
    }
    return id;
  }
  async markSent(id: string) {
    const m = this.markers.find((x) => x.id === id);
    if (m) m.status = 'sent';
  }
  async release(id: string) {
    this.markers = this.markers.filter((m) => m.id !== id);
  }
  async logEvent(input: ReadEventInput) {
    this.events.push(input);
  }
}

function lead(id: string, daysAgo: number, overrides: Partial<ReadLeadRow> = {}): ReadLeadRow {
  return {
    id,
    email: `${id}@example.test`,
    consent_marketing: true,
    session_id: SESSION_ID,
    pattern: 'SHOULDS',
    user_id: null,
    unsubscribed_at: null,
    created_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    ...overrides,
  };
}

const ok = (): ReadEmailOutcome => ({ ok: true, mode: 'preview' });

function deliverSpy(outcome: () => ReadEmailOutcome = ok) {
  const sent: OutgoingReadEmail[] = [];
  const fn = vi.fn(async (m: OutgoingReadEmail) => {
    sent.push(m);
    return outcome();
  });
  return { fn, sent };
}

describe('extractResultParts', () => {
  it('pulls the mirror lines, move, watch and scan from the result blocks', () => {
    const p = extractResultParts(shouldsResult())!;
    expect(p.pattern).toBe('SHOULDS');
    expect(p.mirrorLines).toHaveLength(3);
    expect(p.mirrorLines[0]).toBe('You keep meaning to get to "writing again".');
    expect(p.move).toContain('Take "writing again".');
    expect(p.watch).toContain('Which feels lighter');
    expect(p.scanName).toBe('Value Pattern Decoder');
    expect(p.patternRead).toBe("Most of your week goes to what you think you should do, and the thing you want gets what's left.");
  });

  it('returns null for the crisis tier (no pattern)', () => {
    expect(extractResultParts(shouldsResult({ pattern: null, patternName: null, offer: null }))).toBeNull();
  });
});

describe('sendReadResultEmail (R1)', () => {
  const leadIn = { id: LEAD_ID, email: 'sam@example.test', consentMarketing: false };

  it('sends once with a signed unsubscribe link and List-Unsubscribe URL, regardless of consent', async () => {
    const store = new MemoryStore();
    const d = deliverSpy();
    const out = await sendReadResultEmail({ lead: leadIn, result: shouldsResult(), resultUrl: `${APP}/read/result/x?t=1`, appUrl: APP }, { store, deliver: d.fn });
    expect(out.ok).toBe(true);
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0].kind).toBe('r1');
    expect(d.sent[0].subject).toBe('Your Perception Read: Running on shoulds');
    expect(d.sent[0].text).toContain("It's the only email we'll send you about it.");
    const t = new URL(d.sent[0].listUnsubscribeUrl!).searchParams.get('t');
    expect(verifyReadLink(t)).toEqual({ kind: 'unsubscribe', leadId: LEAD_ID });
    expect(d.sent[0].text).toContain(`${APP}/read/checkout/?session=${SESSION_ID}`);

    const again = await sendReadResultEmail({ lead: leadIn, result: shouldsResult(), resultUrl: `${APP}/r`, appUrl: APP }, { store, deliver: d.fn });
    expect(again.skipped).toBe('already_sent');
    expect(d.sent).toHaveLength(1);
  });

  it('is suppressed for the crisis tier', async () => {
    const d = deliverSpy();
    const out = await sendReadResultEmail(
      { lead: leadIn, result: shouldsResult({ pattern: null, patternName: null, offer: null }), resultUrl: `${APP}/r`, appUrl: APP },
      { store: new MemoryStore(), deliver: d.fn },
    );
    expect(out).toMatchObject({ ok: false, skipped: 'crisis' });
    expect(d.fn).not.toHaveBeenCalled();
  });

  it('never throws on a failed send: logs read_email_failed and releases the claim so it can retry', async () => {
    const store = new MemoryStore();
    const failing = deliverSpy(() => ({ ok: false, mode: 'send', error: 'Gmail API credentials not configured' }));
    const out = await sendReadResultEmail({ lead: leadIn, result: shouldsResult(), resultUrl: `${APP}/r`, appUrl: APP }, { store, deliver: failing.fn });
    expect(out.ok).toBe(false);
    expect(store.markers).toHaveLength(0);
    expect(store.events.map((e) => e.event)).toContain('read_email_failed');

    const retry = deliverSpy();
    expect((await sendReadResultEmail({ lead: leadIn, result: shouldsResult(), resultUrl: `${APP}/r`, appUrl: APP }, { store, deliver: retry.fn })).ok).toBe(true);
  });

  it('never throws when the store itself throws', async () => {
    const store = new MemoryStore();
    store.claim = async () => {
      throw new Error('db down');
    };
    const out = await sendReadResultEmail({ lead: leadIn, result: shouldsResult(), resultUrl: `${APP}/r`, appUrl: APP }, { store, deliver: deliverSpy().fn });
    expect(out).toMatchObject({ ok: false, error: 'db down' });
  });
});

describe('scheduleReadFollowups', () => {
  it('records the follow-up context (pattern, move, baseline, result link)', async () => {
    const store = new MemoryStore();
    const res = await scheduleReadFollowups(
      { leadId: LEAD_ID, sessionId: SESSION_ID, pattern: 'SHOULDS', result: shouldsResult(), resultUrl: `${APP}/r?t=1`, answers: { q10: { questionId: 'q10', number: 3 } } },
      { store },
    );
    expect(res.ok).toBe(true);
    expect(store.events[0].event).toBe('read_followups_scheduled');
    expect(store.events[0].props).toMatchObject({ pattern: 'SHOULDS', baseline: 3, resultUrl: `${APP}/r?t=1` });
    expect((store.events[0].props as any).move).toContain('writing again');
  });

  it('does nothing for the crisis tier', async () => {
    const store = new MemoryStore();
    expect((await scheduleReadFollowups({ leadId: LEAD_ID, sessionId: SESSION_ID, pattern: null }, { store })).ok).toBe(false);
    expect(store.events).toHaveLength(0);
  });
});

describe('runReadFollowups (cron)', () => {
  function seeded() {
    const store = new MemoryStore();
    store.leads = [
      lead('aaaaaaaa-0000-4000-8000-000000000001', 2.5), // day 2 due
      lead('aaaaaaaa-0000-4000-8000-000000000002', 7.2), // day 7 due
      lead('aaaaaaaa-0000-4000-8000-000000000003', 1), // too early
      lead('aaaaaaaa-0000-4000-8000-000000000004', 12), // past every window
    ];
    store.ctx.set('aaaaaaaa-0000-4000-8000-000000000001', {
      pattern: 'SHOULDS',
      patternName: 'Running on shoulds',
      move: 'Take "writing again".',
      watch: null,
      baseline: 4,
      resultUrl: `${APP}/read/result/s?t=x`,
    });
    return store;
  }

  it('sends day 2 and day 7 to due leads only', async () => {
    const store = seeded();
    const d = deliverSpy();
    const r = await runReadFollowups({ store, deliver: d.fn, now: NOW, appUrl: APP });
    expect(r.sent).toBe(2);
    expect(d.sent.map((m) => m.kind).sort()).toEqual(['day2', 'day7']);
    const day2 = d.sent.find((m) => m.kind === 'day2')!;
    expect(day2.text).toContain('Take "writing again".');
    expect(day2.listUnsubscribeUrl).toContain('/api/read/email/unsubscribe?t=');
    const day7 = d.sent.find((m) => m.kind === 'day7')!;
    expect(day7.subject).toBe('Day 7: three quick questions');
    const pmfVery = day7.text.split('\n').find((l) => l.startsWith('- Very disappointed: '))!.replace('- Very disappointed: ', '');
    const payload = verifyReadLink(new URL(pmfVery).searchParams.get('t'), NOW.getTime());
    expect(payload).toMatchObject({ kind: 'answer', leadId: 'aaaaaaaa-0000-4000-8000-000000000002', question: 'pmf', value: 'very' });
  });

  it('is idempotent: a second run (or a second cron the same day) sends nothing', async () => {
    const store = seeded();
    const d = deliverSpy();
    await runReadFollowups({ store, deliver: d.fn, now: NOW, appUrl: APP });
    const second = await runReadFollowups({ store, deliver: d.fn, now: new Date(NOW.getTime() + 3600000), appUrl: APP });
    expect(second.sent).toBe(0);
    expect(second.skipped.already).toBe(2);
    expect(d.sent).toHaveLength(2);
  });

  it('two overlapping runs never double-send (claim: earliest marker wins)', async () => {
    const store = seeded();
    const d = deliverSpy();
    const [a, b] = await Promise.all([
      runReadFollowups({ store, deliver: d.fn, now: NOW, appUrl: APP }),
      runReadFollowups({ store, deliver: d.fn, now: NOW, appUrl: APP }),
    ]);
    expect(a.sent + b.sent).toBe(2);
    expect(d.sent).toHaveLength(2);
  });

  it('respects consent and unsubscribe', async () => {
    const store = new MemoryStore();
    store.leads = [
      lead('bbbbbbbb-0000-4000-8000-000000000001', 2.5, { consent_marketing: false }),
      lead('bbbbbbbb-0000-4000-8000-000000000002', 2.5, { unsubscribed_at: NOW.toISOString() }),
      lead('bbbbbbbb-0000-4000-8000-000000000003', 7.5, { consent_marketing: null }),
    ];
    const d = deliverSpy();
    const r = await runReadFollowups({ store, deliver: d.fn, now: NOW, appUrl: APP });
    expect(r.sent).toBe(0);
    expect(d.fn).not.toHaveBeenCalled();
  });

  it('sends one series per email: an older lead for the same address is superseded', async () => {
    const store = new MemoryStore();
    store.leads = [
      lead('cccccccc-0000-4000-8000-000000000001', 7.5, { email: 'Same@Example.test' }),
      lead('cccccccc-0000-4000-8000-000000000002', 2.5, { email: 'same@example.test' }),
    ];
    // listLeadsByEmails is exact-match in Supabase too; newest is computed case-insensitively.
    store.listLeadsByEmails = async () => store.leads;
    const d = deliverSpy();
    const r = await runReadFollowups({ store, deliver: d.fn, now: NOW, appUrl: APP });
    expect(r.skipped.superseded).toBe(1);
    expect(d.sent.map((m) => m.kind)).toEqual(['day2']);
  });

  it('retries a failed send on the next run, and records the failure', async () => {
    const store = seeded();
    const failing = deliverSpy(() => ({ ok: false, mode: 'send', error: 'SENDER_EMAIL not configured' }));
    const first = await runReadFollowups({ store, deliver: failing.fn, now: NOW, appUrl: APP });
    expect(first.failed).toBe(2);
    expect(store.markers).toHaveLength(0);
    expect(store.events.filter((e) => e.event === 'read_email_failed')).toHaveLength(2);

    const d = deliverSpy();
    const second = await runReadFollowups({ store, deliver: d.fn, now: NOW, appUrl: APP });
    expect(second.sent).toBe(2);
  });

  it('uses fixed windows so a late cron never sends day 2 on day 6', () => {
    expect(FOLLOWUP_WINDOWS.day2).toEqual({ minDays: 2, maxDays: 5 });
    expect(FOLLOWUP_WINDOWS.day7).toEqual({ minDays: 7, maxDays: 10 });
  });
});
