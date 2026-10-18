// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { ReadSessionRow } from '@/lib/read/store';

const h = vi.hoisted(() => ({
  productRow: { data: { product_slug: 'perception-read', is_active: true } as unknown, error: null as unknown },
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => {
      const b: any = {};
      for (const op of ['select', 'eq']) b[op] = () => b;
      b.maybeSingle = () => Promise.resolve(h.productRow);
      return b;
    },
  },
}));

vi.mock('@/lib/read/store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/read/store')>();
  return {
    ...real,
    createReadSession: vi.fn(),
    getReadSession: vi.fn(),
    verifyReadToken: vi.fn(),
    saveAnswer: vi.fn(),
    updateSessionData: vi.fn(),
    markComplete: vi.fn(),
    createLead: vi.fn(),
    linkLeadToSession: vi.fn(),
    recordEvent: vi.fn(),
  };
});

// The unlock route runs its email work through `after()`. Outside a request scope the real
// `after` throws, so the test runs the callback immediately instead.
vi.mock('next/server', async (importOriginal) => {
  const real = await importOriginal<typeof import('next/server')>();
  return {
    ...real,
    after: (task: unknown) => {
      if (typeof task === 'function') return task();
      return task;
    },
  };
});

// The mirror paragraph model is not called from these route tests (no network): the
// writer resolves a fixed paragraph. Its own behaviour is covered in __tests__/paragraph.test.ts.
vi.mock('@/lib/read/paragraph', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/read/paragraph')>();
  return { ...real, writeMirrorParagraph: vi.fn(async () => ({ text: 'Fixed mirror paragraph.', usedFallback: false })) };
});

vi.mock('@/lib/read/emails', () => ({
  onReadUnlocked: vi.fn(),
  sendReadResultEmail: vi.fn(),
  scheduleReadFollowups: vi.fn(),
}));

import * as store from '@/lib/read/store';
import * as emails from '@/lib/read/emails';
import { SHOULDS_ANSWERS } from '@/lib/read/__tests__/fixtures';
import { POST as start } from '../start/route';
import { GET as questions } from '../questions/route';
import { POST as answer } from '../answer/route';
import { POST as complete } from '../complete/route';
import { POST as unlock } from '../unlock/route';
import { GET as result } from '../result/[sessionId]/route';
import { POST as event } from '../event/route';
import { POST as feedback } from '../feedback/route';
import { READ_RATE_LIMITS } from '../_lib/http';

const SID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'cookie-token';

let ipN = 0;
const freshIp = () => `10.0.${Math.floor(++ipN / 250)}.${ipN % 250}`;

function req(
  url: string,
  opts: { method?: string; body?: unknown; cookie?: string | null; ip?: string; rawBody?: string } = {}
) {
  const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? freshIp() };
  if (opts.cookie !== null) headers.cookie = `qs_read_token=${opts.cookie ?? TOKEN}`;
  if (opts.body !== undefined || opts.rawBody !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
}

const baseRow = (over: Partial<ReadSessionRow> = {}): ReadSessionRow => ({
  id: SID,
  product_slug: 'perception-read',
  user_id: null,
  lead_id: null,
  anon_token_hash: 'h',
  utm: null,
  step_data: {},
  session_data: {},
  completed_at: null,
  created_at: '2026-10-18T00:00:00Z',
  ...over,
});

/** A complete, valid answer set that lands on SHOULDS (every required question answered). */
const fullAnswers = (q8 = 'gets things done') => ({
  ...SHOULDS_ANSWERS,
  q8: { questionId: 'q8', parts: { line1: q8, line2: 'keeps the house running', line3: 'reads on Sundays' } },
});

/** Cookie auth succeeds only for TOKEN, returning `row`. */
function authAs(row: ReadSessionRow | null) {
  vi.mocked(store.verifyReadToken).mockImplementation(async (_sid, token) => (token === TOKEN ? row : null));
  vi.mocked(store.getReadSession).mockResolvedValue(row);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.productRow = { data: { product_slug: 'perception-read', is_active: true }, error: null };
  process.env.READ_LINK_SECRET = 's'.repeat(40);
  vi.mocked(store.saveAnswer).mockResolvedValue(true);
  vi.mocked(store.updateSessionData).mockResolvedValue({});
  vi.mocked(store.markComplete).mockResolvedValue();
  vi.mocked(store.recordEvent).mockResolvedValue();
  vi.mocked(store.linkLeadToSession).mockResolvedValue();
});

// ─── start ───────────────────────────────────────────────────────────────────
describe('POST /api/read/start', () => {
  it('creates an anonymous session and sets the httpOnly cookie', async () => {
    vi.mocked(store.createReadSession).mockResolvedValue({ sessionId: SID, token: 'raw-token' });
    const res = await start(req('/api/read/start', { body: { utm: { source: 'yt' }, variant: 'manifestation' }, cookie: null }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessionId: SID });
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toContain('qs_read_token=raw-token');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(store.createReadSession).toHaveBeenCalledWith({ source: 'yt' }, 'manifestation');
    expect(store.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_start', sessionId: SID }));
  });

  it('accepts an empty body', async () => {
    vi.mocked(store.createReadSession).mockResolvedValue({ sessionId: SID, token: 't' });
    const res = await start(req('/api/read/start', { cookie: null }));
    expect(res.status).toBe(200);
  });

  it('rejects unknown fields', async () => {
    const res = await start(req('/api/read/start', { body: { evil: 1 }, cookie: null }));
    expect(res.status).toBe(400);
  });

  it('returns 503 when the product row is missing or inactive (kill switch)', async () => {
    h.productRow = { data: { product_slug: 'perception-read', is_active: false }, error: null };
    const res = await start(req('/api/read/start', { body: {}, cookie: null }));
    expect(res.status).toBe(503);
    expect(store.createReadSession).not.toHaveBeenCalled();
  });

  it('rate limits per IP', async () => {
    vi.mocked(store.createReadSession).mockResolvedValue({ sessionId: SID, token: 't' });
    const ip = freshIp();
    const max = READ_RATE_LIMITS.start.ip.maxRequests;
    for (let i = 0; i < max; i++) {
      expect((await start(req('/api/read/start', { body: {}, cookie: null, ip }))).status).toBe(200);
    }
    const res = await start(req('/api/read/start', { body: {}, cookie: null, ip }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
});

// ─── questions ───────────────────────────────────────────────────────────────
describe('GET /api/read/questions', () => {
  it('filters segment-only options and ignores bad params', async () => {
    const op = await (await questions(req('/api/read/questions?segment=operator', { method: 'GET' }))).json();
    const none = await (await questions(req('/api/read/questions?segment=bogus&variant=<x>', { method: 'GET' }))).json();
    const q2 = (qs: any[]) => qs.find((q) => q.id === 'q2').options.map((o: any) => o.value);
    expect(q2(op.questions)).toContain('say:undercharge');
    expect(q2(none.questions)).not.toContain('say:undercharge');
  });
});

// ─── answer ──────────────────────────────────────────────────────────────────
describe('POST /api/read/answer', () => {
  const post = (body: unknown, cookie?: string | null, ip?: string) => answer(req('/api/read/answer', { body, cookie, ip }));

  it('saves a valid answer and records tags only', async () => {
    authAs(baseRow());
    const res = await post({ sessionId: SID, answer: { questionId: 'q1', choice: ['seg:operator'] } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(store.saveAnswer).toHaveBeenCalledWith(SID, { questionId: 'q1', choice: ['seg:operator'] }, 1);
    expect(store.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'read_step_submit', step: 'q1', props: expect.objectContaining({ choice: ['seg:operator'] }) })
    );
  });

  it('never puts answer text in events', async () => {
    authAs(baseRow());
    await post({ sessionId: SID, answer: { questionId: 'q8', parts: { line1: 'a very private sentence' } } });
    const serialized = JSON.stringify(vi.mocked(store.recordEvent).mock.calls);
    expect(serialized).not.toContain('a very private sentence');
  });

  it.each([
    ['unknown question', { questionId: 'q99', choice: ['x'] }, 'unknown_question'],
    ['unknown option', { questionId: 'q1', choice: ['seg:martian'] }, 'unknown_option'],
    ['two picks on single', { questionId: 'q1', choice: ['seg:operator', 'seg:other'] }, 'choose_one'],
    ['too many picks', { questionId: 'q2', choice: ['say:stall', 'say:shoulds', 'say:other', 'say:undercharge'] }, 'too_many_choices'],
    ['loudest not picked', { questionId: 'q2', choice: ['say:stall', 'say:shoulds'], parts: { loudest: 'say:other' } }, 'part_not_picked'],
    ['loudest missing', { questionId: 'q2', choice: ['say:stall', 'say:shoulds'] }, 'part_required'],
    ['scale out of range', { questionId: 'q10', number: 11 }, 'number_out_of_range'],
    ['scale not integer', { questionId: 'q10', number: 2.5 }, 'number_required'],
    ['malformed question id', { questionId: 'q9x' }, null],
    ['bad part option', { questionId: 'q7', parts: { thing: 'x', hours: 'hours:999', wantOrShould: 'own:want' } }, 'unknown_option'],
    ['empty required answer', { questionId: 'q1' }, 'answer_required'],
  ])('rejects %s', async (_name, ans, code) => {
    authAs(baseRow());
    const res = await post({ sessionId: SID, answer: ans });
    expect(res.status).toBe(400);
    if (code) expect((await res.json()).error).toBe(code);
    expect(store.saveAnswer).not.toHaveBeenCalled();
  });

  it('accepts the UI shapes leniently (Q7 text+number, Q8 text+parts, Q11-style part tags in choice)', async () => {
    authAs(baseRow());
    const q7 = { questionId: 'q7', text: 'writing', number: 0, parts: { thing: 'writing', hours: 'hours:0', instead: null, wantOrShould: 'own:want' } };
    expect((await post({ sessionId: SID, answer: q7 })).status).toBe(200);
    const q8 = { questionId: 'q8', text: 'a\nb\nc', parts: { line1: 'a', line2: 'b', line3: 'c' } };
    expect((await post({ sessionId: SID, answer: q8 })).status).toBe(200);
    const q7Tag = { questionId: 'q7', choice: ['hours:0'], parts: { thing: 'x', hours: 'hours:0', wantOrShould: 'own:want', out: 'extra' } };
    expect((await post({ sessionId: SID, answer: q7Tag })).status).toBe(200);
  });

  it('allows skipping an optional question', async () => {
    authAs(baseRow());
    const res = await post({ sessionId: SID, answer: { questionId: 'q12' } });
    expect(res.status).toBe(200);
  });

  it('rejects oversized text and non-uuid session ids', async () => {
    authAs(baseRow());
    expect((await post({ sessionId: SID, answer: { questionId: 'q8', text: 'x'.repeat(5000) } })).status).toBe(400);
    expect((await post({ sessionId: 'abc', answer: { questionId: 'q1', choice: ['seg:operator'] } })).status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await answer(req('/api/read/answer', { rawBody: '{nope' }));
    expect(res.status).toBe(400);
  });

  it('403 without the cookie token or with a wrong one', async () => {
    authAs(baseRow());
    const body = { sessionId: SID, answer: { questionId: 'q1', choice: ['seg:operator'] } };
    expect((await post(body, null)).status).toBe(403);
    expect((await post(body, 'stolen')).status).toBe(403);
    expect(store.saveAnswer).not.toHaveBeenCalled();
  });

  it('409 on a completed session', async () => {
    authAs(baseRow({ completed_at: '2026-10-18T01:00:00Z' }));
    const res = await post({ sessionId: SID, answer: { questionId: 'q1', choice: ['seg:operator'] } });
    expect(res.status).toBe(409);
  });

  it('screens text, returns the tier, stores the worst tier and records tier only', async () => {
    authAs(baseRow());
    const res = await post({ sessionId: SID, answer: { questionId: 'q8', parts: { line1: 'I want to die' } } });
    expect(await res.json()).toEqual({ ok: true, safety: { tier: 'crisis', matchedLists: ['crisis:suicide'] } });
    expect(store.updateSessionData).toHaveBeenCalledWith(SID, { safety: { tier: 'crisis', matchedLists: ['crisis:suicide'] } });
    const safetyEvent = vi.mocked(store.recordEvent).mock.calls.find((c) => c[0].event === 'read_safety_triggered')!;
    expect(safetyEvent[0].props).toMatchObject({ tier: 'crisis' });
    expect(JSON.stringify(safetyEvent)).not.toContain('die');
  });

  it('does not downgrade a stored worse tier', async () => {
    authAs(baseRow({ session_data: { safety: { tier: 'crisis', matchedLists: ['crisis:suicide'] } } }));
    await post({ sessionId: SID, answer: { questionId: 'q8', parts: { line1: 'I got laid off' } } });
    expect(store.updateSessionData).not.toHaveBeenCalled();
  });

  it('rate limits per session across IPs', async () => {
    authAs(baseRow());
    const sid = '22222222-2222-4333-8444-555555555555';
    vi.mocked(store.verifyReadToken).mockResolvedValue(baseRow({ id: sid }));
    const max = READ_RATE_LIMITS.answer.session!.maxRequests;
    for (let i = 0; i < max; i++) {
      await post({ sessionId: sid, answer: { questionId: 'q1', choice: ['seg:operator'] } });
    }
    const res = await post({ sessionId: sid, answer: { questionId: 'q1', choice: ['seg:operator'] } });
    expect(res.status).toBe(429);
  });
});

// ─── complete ────────────────────────────────────────────────────────────────
describe('POST /api/read/complete', () => {
  const post = (cookie?: string | null) => complete(req('/api/read/complete', { body: { sessionId: SID }, cookie }));

  it('returns the preview (mirror + pattern) and marks complete', async () => {
    authAs(baseRow({ step_data: fullAnswers() as any }));
    const res = await post();
    expect(res.status).toBe(200);
    const preview = await res.json();
    expect(preview.sessionId).toBe(SID);
    expect(preview.safety.tier).toBe('none');
    expect(preview.mirror.thing).toBe('writing again');
    expect(preview.pattern).toMatchObject({ id: 'SHOULDS', name: expect.any(String), read: expect.any(String) });
    expect(preview.youSaid).toBe("I'm doing what I'm supposed to, and it feels like someone else's life.");
    expect(store.markComplete).toHaveBeenCalledWith(SID, expect.objectContaining({ preview, scores: expect.any(Object) }));
    expect(store.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_complete' }));
  });

  it('crisis tier: no mirror, no pattern, no scores stored', async () => {
    authAs(baseRow({ step_data: fullAnswers('sometimes I want to kill myself') as any }));
    const preview = await (await post()).json();
    expect(preview).toEqual({ sessionId: SID, safety: { tier: 'crisis', matchedLists: ['crisis:suicide'] }, mirror: null, pattern: null });
    expect(store.markComplete).toHaveBeenCalledWith(SID, expect.objectContaining({ scores: null, mirror: null }));
  });

  it('crisis stored from an earlier answer wins even if text was later changed', async () => {
    authAs(baseRow({ step_data: fullAnswers() as any, session_data: { safety: { tier: 'crisis', matchedLists: ['crisis:suicide'] } } }));
    const preview = await (await post()).json();
    expect(preview.pattern).toBeNull();
  });

  it('400 with the missing required questions', async () => {
    authAs(baseRow({ step_data: { q1: fullAnswers().q1 } as any }));
    const res = await post();
    expect(res.status).toBe(400);
    expect((await res.json()).missing).toEqual(expect.arrayContaining(['q2', 'q7', 'q8', 'q10']));
  });

  it('is idempotent once complete', async () => {
    const stored = { sessionId: SID, safety: { tier: 'none', matchedLists: [] }, mirror: null, pattern: null };
    authAs(baseRow({ completed_at: 'x', session_data: { preview: stored as any } }));
    expect(await (await post()).json()).toEqual(stored);
    expect(store.markComplete).not.toHaveBeenCalled();
  });

  it('403 without the cookie', async () => {
    authAs(baseRow());
    expect((await post(null)).status).toBe(403);
  });
});

// ─── unlock ──────────────────────────────────────────────────────────────────
describe('POST /api/read/unlock', () => {
  const completedRow = (over: Partial<ReadSessionRow> = {}) =>
    baseRow({
      completed_at: '2026-10-18T01:00:00Z',
      step_data: fullAnswers() as any,
      utm: { source: 'yt' },
      session_data: {
        safety: { tier: 'none', matchedLists: [] },
        scores: { pattern: 'SHOULDS', scores: {} as any, lowSignal: false, reasons: [] },
        mirror: { thing: 'writing again', hours: 0, instead: null, wantOrShould: 'want', showsGap: true, line: 'l' },
        preview: { sessionId: SID } as any,
      },
      ...over,
    });
  const lead = { id: 'L1', email: 'a@b.co', consentMarketing: true, consentAt: 'now', unsubscribedAt: null, utm: null, sessionId: SID, pattern: 'SHOULDS' as const, userId: null };
  const post = (body: unknown, cookie?: string | null, ip?: string) => unlock(req('/api/read/unlock', { body, cookie, ip }));

  beforeEach(() => {
    vi.mocked(store.createLead).mockResolvedValue(lead);
    // onReadUnlocked sends R1 and schedules the follow-ups; its own behaviour is covered in
    // src/lib/read/__tests__/emails.test.ts. The route only has to hand it the right inputs.
    vi.mocked(emails.onReadUnlocked).mockResolvedValue({ r1: { ok: true } as any, followups: {} as any });
  });

  it('creates the lead, builds + stores the result, hands the email work off after the response', async () => {
    authAs(completedRow());
    const res = await post({ sessionId: SID, lead: { email: ' A@B.co ', consentMarketing: true } });
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result).toMatchObject({ sessionId: SID, pattern: 'SHOULDS', offer: { productSlug: 'perception-rite-bundle', priceUsd: 12 } });
    expect(store.createLead).toHaveBeenCalledWith(expect.objectContaining({ email: 'A@B.co', consentMarketing: true, sessionId: SID, pattern: 'SHOULDS', utm: { source: 'yt' } }));
    expect(store.linkLeadToSession).toHaveBeenCalledWith(SID, 'L1');
    expect(store.updateSessionData).toHaveBeenCalledWith(SID, expect.objectContaining({ result }));
    expect(emails.onReadUnlocked).toHaveBeenCalledTimes(1);
    const emailArg = vi.mocked(emails.onReadUnlocked).mock.calls[0][0];
    expect(emailArg.lead).toBe(lead);
    expect(emailArg.result).toEqual(result);
    expect(emailArg.answers).toEqual(completedRow().step_data);
    const t = new URL(emailArg.resultUrl).searchParams.get('t');
    expect(store.verifyResultToken(SID, t)).toBe(true);
    expect(store.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_email_submit', leadId: 'L1' }));
  });

  it('still returns the result when the email work fails', async () => {
    authAs(completedRow());
    vi.mocked(emails.onReadUnlocked).mockRejectedValueOnce(new Error('smtp down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post({ sessionId: SID, lead: { email: 'a@b.co', consentMarketing: false } });
    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it('reuses a stored result instead of rebuilding', async () => {
    const stored = { sessionId: SID, pattern: 'SHOULDS', patternName: 'x', blocks: [], offer: null, usedFallback: false };
    authAs(completedRow({ session_data: { ...completedRow().session_data!, result: stored as any } }));
    expect(await (await post({ sessionId: SID, lead: { email: 'a@b.co', consentMarketing: false } })).json()).toEqual(stored);
    expect(store.updateSessionData).not.toHaveBeenCalled();
  });

  it('refuses crisis-tier sessions (no gate, no email)', async () => {
    authAs(completedRow({ session_data: { safety: { tier: 'crisis', matchedLists: [] }, scores: null, mirror: null, preview: {} as any } }));
    const res = await post({ sessionId: SID, lead: { email: 'a@b.co', consentMarketing: true } });
    expect(res.status).toBe(403);
    expect(store.createLead).not.toHaveBeenCalled();
    expect(emails.onReadUnlocked).not.toHaveBeenCalled();
  });

  it('409 before complete', async () => {
    authAs(baseRow());
    expect((await post({ sessionId: SID, lead: { email: 'a@b.co', consentMarketing: false } })).status).toBe(409);
  });

  it('validates the email and the consent flag', async () => {
    authAs(completedRow());
    // A separate session id: the per-session unlock limit (5/hour) is shared across this file.
    const sid = '44444444-2222-4333-8444-555555555555';
    expect((await post({ sessionId: sid, lead: { email: 'not-an-email', consentMarketing: false } })).status).toBe(400);
    expect((await post({ sessionId: sid, lead: { email: 'a@b.co' } })).status).toBe(400);
    expect((await post({ sessionId: sid, lead: { email: 'a@b.co', consentMarketing: 'yes' } })).status).toBe(400);
    expect(store.createLead).not.toHaveBeenCalled();
  });

  it('403 without the cookie', async () => {
    authAs(completedRow());
    const sid = '55555555-2222-4333-8444-555555555555';
    expect((await post({ sessionId: sid, lead: { email: 'a@b.co', consentMarketing: false } }, null)).status).toBe(403);
  });

  it('rate limits per IP', async () => {
    authAs(baseRow());
    const ip = freshIp();
    const max = READ_RATE_LIMITS.unlock.ip.maxRequests;
    for (let i = 0; i < max; i++) {
      const sid = `33333333-2222-4333-8444-${String(i).padStart(12, '0')}`;
      await post({ sessionId: sid, lead: { email: 'a@b.co', consentMarketing: false } }, undefined, ip);
    }
    const res = await post({ sessionId: SID, lead: { email: 'a@b.co', consentMarketing: false } }, undefined, ip);
    expect(res.status).toBe(429);
  });
});

// ─── result ──────────────────────────────────────────────────────────────────
describe('GET /api/read/result/[sessionId]', () => {
  const stored = { sessionId: SID, pattern: 'SHOULDS', patternName: 'x', blocks: [], offer: null, usedFallback: false };
  const get = (qs = '', cookie?: string | null, sid = SID) =>
    result(req(`/api/read/result/${sid}${qs}`, { method: 'GET', cookie }), { params: Promise.resolve({ sessionId: sid }) });

  it('serves with the cookie', async () => {
    authAs(baseRow({ session_data: { result: stored as any } }));
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(stored);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(store.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_result_view', props: expect.objectContaining({ via: 'cookie' }) }));
  });

  it('serves with a valid signed link and no cookie', async () => {
    authAs(baseRow({ session_data: { result: stored as any } }));
    const t = store.signResultToken(SID);
    const res = await get(`?t=${encodeURIComponent(t)}`, null);
    expect(res.status).toBe(200);
  });

  it('403 with a link signed for another session, a tampered link, or nothing', async () => {
    authAs(baseRow({ session_data: { result: stored as any } }));
    const other = store.signResultToken('99999999-2222-4333-8444-555555555555');
    expect((await get(`?t=${other}`, null)).status).toBe(403);
    expect((await get(`?t=123.abc`, null)).status).toBe(403);
    expect((await get('', null)).status).toBe(403);
  });

  it('404 before unlock', async () => {
    authAs(baseRow({ completed_at: 'x', session_data: {} }));
    expect((await get()).status).toBe(404);
  });

  it('400 on a non-uuid id', async () => {
    expect((await get('', undefined, 'abc')).status).toBe(400);
  });
});

// ─── event ───────────────────────────────────────────────────────────────────
describe('POST /api/read/event', () => {
  const post = (body: unknown, cookie?: string | null) => event(req('/api/read/event', { body, cookie }));

  it('records a sessionless landing view', async () => {
    const res = await post({ event: 'read_view_landing', props: { variant: 'manifestation' } }, null);
    expect(res.status).toBe(204);
    expect(store.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_view_landing' }));
  });

  it('requires a session for other events', async () => {
    expect((await post({ event: 'read_offer_click' }, null)).status).toBe(400);
  });

  it('refuses server-only events from the browser', async () => {
    authAs(baseRow());
    expect((await post({ sessionId: SID, event: 'read_purchase' })).status).toBe(400);
    expect((await post({ sessionId: SID, event: 'read_complete' })).status).toBe(400);
  });

  it('records with session context when the cookie matches; 403 otherwise', async () => {
    authAs(baseRow({ lead_id: 'L1' }));
    expect((await post({ sessionId: SID, event: 'read_offer_click', step: 'offer' })).status).toBe(204);
    expect(store.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ leadId: 'L1', sessionId: SID }));
    expect((await post({ sessionId: SID, event: 'read_offer_click' }, 'nope')).status).toBe(403);
  });

  it('accepts the signed link token in the body', async () => {
    authAs(baseRow());
    const t = store.signResultToken(SID);
    expect((await post({ sessionId: SID, t, event: 'read_offer_click' }, null)).status).toBe(204);
  });

  it('rejects long prop strings', async () => {
    expect((await post({ event: 'read_view_landing', props: { x: 'y'.repeat(500) } }, null)).status).toBe(400);
  });
});

// ─── feedback ────────────────────────────────────────────────────────────────
describe('POST /api/read/feedback', () => {
  const post = (body: unknown, cookie?: string | null) => feedback(req('/api/read/feedback', { body, cookie }));

  it('stores feedback on the session and records rating events without text', async () => {
    authAs(baseRow({ completed_at: 'x' }));
    const res = await post({ sessionId: SID, accuracy: 4, hardestPart: 'my own private words', moveCommitted: true });
    expect(res.status).toBe(204);
    expect(store.updateSessionData).toHaveBeenCalledWith(
      SID,
      { feedback: expect.objectContaining({ accuracy: 4, hardestPart: 'my own private words', hardestPartSafetyTier: 'none', moveCommitted: true }) }
    );
    const events = vi.mocked(store.recordEvent).mock.calls.map((c) => c[0].event);
    expect(events).toEqual(['read_accuracy_rated', 'read_move_committed']);
    expect(JSON.stringify(vi.mocked(store.recordEvent).mock.calls)).not.toContain('private words');
  });

  it('validates accuracy range and empty bodies', async () => {
    authAs(baseRow({ completed_at: 'x' }));
    expect((await post({ sessionId: SID, accuracy: 6 })).status).toBe(400);
    expect((await post({ sessionId: SID })).status).toBe(400);
  });

  it('409 before complete, 403 without auth', async () => {
    authAs(baseRow());
    expect((await post({ sessionId: SID, accuracy: 3 })).status).toBe(409);
    expect((await post({ sessionId: SID, accuracy: 3 }, null)).status).toBe(403);
  });
});
