import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));
vi.mock('@/lib/read/email-store', () => ({
  unsubscribeLead: vi.fn(async () => true),
  getLeadById: vi.fn(),
  logReadEvent: vi.fn(async () => 'evt'),
}));
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: 0 })) }));

import { POST as unsubscribe } from '../unsubscribe/route';
import { POST as answer } from '../answer/route';
import { getLeadById, logReadEvent, unsubscribeLead } from '@/lib/read/email-store';
import { signReadLink } from '@/lib/read/email-links';

const LEAD_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';

beforeAll(() => {
  process.env.READ_LINK_SECRET = 'test-secret';
});

beforeEach(() => {
  vi.mocked(getLeadById).mockResolvedValue({
    id: LEAD_ID,
    email: 'sam@example.test',
    consent_marketing: true,
    session_id: SESSION_ID,
    pattern: 'SHOULDS',
    user_id: null,
    unsubscribed_at: null,
    created_at: '2026-10-10T00:00:00Z',
  });
  vi.mocked(unsubscribeLead).mockResolvedValue(true);
});

const json = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const answerToken = (question: 'pmf' | 'rerate' | 'move', value: string) =>
  signReadLink({ kind: 'answer', leadId: LEAD_ID, question, value, expiresAt: Date.now() + 60_000 });

describe('POST /api/read/email/unsubscribe', () => {
  it('unsubscribes from the page (JSON token)', async () => {
    const t = signReadLink({ kind: 'unsubscribe', leadId: LEAD_ID });
    const res = await unsubscribe(json('http://localhost/api/read/email/unsubscribe', { t }));
    expect(res.status).toBe(200);
    expect(unsubscribeLead).toHaveBeenCalledWith(LEAD_ID, 'page');
  });

  it('supports RFC 8058 one-click (form POST, token in the query)', async () => {
    const t = signReadLink({ kind: 'unsubscribe', leadId: LEAD_ID });
    const req = new NextRequest(`http://localhost/api/read/email/unsubscribe?t=${encodeURIComponent(t)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    });
    const res = await unsubscribe(req);
    expect(res.status).toBe(200);
    expect(unsubscribeLead).toHaveBeenCalledWith(LEAD_ID, 'one_click');
  });

  it('rejects bad tokens and answer tokens', async () => {
    expect((await unsubscribe(json('http://localhost/x', { t: 'forged.token' }))).status).toBe(400);
    expect((await unsubscribe(json('http://localhost/x', { t: answerToken('pmf', 'very') }))).status).toBe(400);
    expect(unsubscribeLead).not.toHaveBeenCalled();
  });

  it('404s an unknown lead and 500s a DB failure', async () => {
    const t = signReadLink({ kind: 'unsubscribe', leadId: LEAD_ID });
    vi.mocked(unsubscribeLead).mockResolvedValueOnce(false);
    expect((await unsubscribe(json('http://localhost/x', { t }))).status).toBe(404);
    vi.mocked(unsubscribeLead).mockRejectedValueOnce(new Error('db'));
    expect((await unsubscribe(json('http://localhost/x', { t }))).status).toBe(500);
  });
});

describe('POST /api/read/email/answer', () => {
  it('records the PMF answer and opens the follow-ups for "very"', async () => {
    const res = await answer(json('http://localhost/api/read/email/answer', { t: answerToken('pmf', 'very') }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, question: 'pmf', value: 'very', followup: true });
    expect(logReadEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'day7_pmf', leadId: LEAD_ID, sessionId: SESSION_ID, props: expect.objectContaining({ answer: 'very', pattern: 'SHOULDS' }) }),
    );
  });

  it('does not open follow-ups for "not disappointed"', async () => {
    const res = await answer(json('http://localhost/x', { t: answerToken('pmf', 'not') }));
    expect((await res.json()).followup).toBe(false);
  });

  it('records the re-rating as a number and the move answer', async () => {
    await answer(json('http://localhost/x', { t: answerToken('rerate', '7') }));
    expect(logReadEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'day7_rerating', props: expect.objectContaining({ rating: 7 }) }));
    await answer(json('http://localhost/x', { t: answerToken('move', 'started_stopped') }));
    expect(logReadEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'move_done_day7', props: expect.objectContaining({ answer: 'started_stopped' }) }));
  });

  it('records the two Superhuman follow-ups, only for very/somewhat tokens', async () => {
    const ok = await answer(json('http://localhost/x', { t: answerToken('pmf', 'somewhat'), mainThing: 'The hours line', whoHelps: 'Freelancers' }));
    expect(ok.status).toBe(200);
    expect(logReadEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'day7_pmf_followup', props: expect.objectContaining({ pmf: 'somewhat', main_thing: 'The hours line', who_helps: 'Freelancers' }) }),
    );
    const notAllowed = await answer(json('http://localhost/x', { t: answerToken('pmf', 'not'), mainThing: 'x' }));
    expect(notAllowed.status).toBe(400);
    const empty = await answer(json('http://localhost/x', { t: answerToken('pmf', 'very'), mainThing: '  ' }));
    expect(empty.status).toBe(400);
  });

  it('rejects missing, forged and expired tokens', async () => {
    expect((await answer(json('http://localhost/x', {}))).status).toBe(400);
    expect((await answer(json('http://localhost/x', { t: 'a.b' }))).status).toBe(400);
    const expired = signReadLink({ kind: 'answer', leadId: LEAD_ID, question: 'pmf', value: 'very', expiresAt: 5 });
    expect((await answer(json('http://localhost/x', { t: expired }))).status).toBe(400);
    expect(logReadEvent).not.toHaveBeenCalled();
  });

  it('404s an unknown lead', async () => {
    vi.mocked(getLeadById).mockResolvedValueOnce(null);
    expect((await answer(json('http://localhost/x', { t: answerToken('move', 'yes') }))).status).toBe(404);
  });
});
