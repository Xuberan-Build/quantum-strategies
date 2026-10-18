// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFakeSupabase } from './fake-supabase';

const fake = vi.hoisted(() => ({ ref: null as null | ReturnType<typeof import('./fake-supabase').createFakeSupabase> }));

vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return fake.ref!.client;
  },
}));

import {
  createLead,
  createReadSession,
  eventContext,
  hashReadToken,
  markComplete,
  normaliseEmail,
  recordEvent,
  resultUrl,
  saveAnswer,
  signResultToken,
  verifyReadToken,
  verifyResultToken,
  type ReadSessionRow,
} from '../store';

const SID = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';

const db = createFakeSupabase();
fake.ref = db;

const row = (over: Partial<ReadSessionRow> = {}): ReadSessionRow => ({
  id: SID,
  product_slug: 'perception-read',
  user_id: null,
  lead_id: null,
  anon_token_hash: null,
  utm: null,
  step_data: {},
  session_data: {},
  completed_at: null,
  created_at: '2026-10-18T00:00:00Z',
  ...over,
});

beforeEach(() => db.reset());

describe('createReadSession', () => {
  it('stores only the sha256 of a 32-byte token, anonymous, on perception-read', async () => {
    db.queue('product_sessions', { data: { id: SID }, error: null });
    const { sessionId, token } = await createReadSession({ source: 'yt' }, 'manifestation');
    expect(sessionId).toBe(SID);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    const insert = db.callsFor('product_sessions', 'insert')[0].args[0] as Record<string, any>;
    expect(insert.user_id).toBeNull();
    expect(insert.product_slug).toBe('perception-read');
    expect(insert.anon_token_hash).toBe(hashReadToken(token));
    expect(insert.anon_token_hash).not.toContain(token);
    expect(insert.utm).toEqual({ source: 'yt', variant: 'manifestation' });
    expect(insert.session_data).toEqual({ variant: 'manifestation' });
  });

  it('throws when the insert fails', async () => {
    db.queue('product_sessions', { data: null, error: { message: 'boom' } });
    await expect(createReadSession()).rejects.toThrow(/createReadSession failed/);
  });
});

describe('verifyReadToken', () => {
  it('accepts the issued token and rejects others', async () => {
    const token = 'tok-abc';
    db.queue('product_sessions', { data: row({ anon_token_hash: hashReadToken(token) }), error: null });
    expect(await verifyReadToken(SID, token)).toMatchObject({ id: SID });

    db.queue('product_sessions', { data: row({ anon_token_hash: hashReadToken(token) }), error: null });
    expect(await verifyReadToken(SID, 'wrong')).toBeNull();
  });

  it('rejects without touching the DB for missing token or bad id', async () => {
    expect(await verifyReadToken(SID, null)).toBeNull();
    expect(await verifyReadToken('not-a-uuid', 'x')).toBeNull();
    expect(db.calls).toHaveLength(0);
  });

  it('rejects rows without a token hash (owned sessions)', async () => {
    db.queue('product_sessions', { data: row({ user_id: OTHER, anon_token_hash: null }), error: null });
    expect(await verifyReadToken(SID, 'x')).toBeNull();
  });
});

describe('saveAnswer', () => {
  it('uses the atomic SQL function and reports refusals', async () => {
    db.queueRpc({ data: true, error: null }, { data: null, error: null });
    const a = { questionId: 'q1', choice: ['seg:operator'] };
    expect(await saveAnswer(SID, a, 1)).toBe(true);
    expect(db.rpcCalls[0]).toEqual({
      fn: 'read_save_answer',
      args: { p_session_id: SID, p_question_id: 'q1', p_answer: a, p_step: 1 },
    });
    expect(await saveAnswer(SID, a)).toBe(false);
  });
});

describe('markComplete', () => {
  it('sets completed_at once and merges session_data', async () => {
    db.queue('product_sessions', { data: row({ session_data: { variant: 'x' } }), error: null }, { data: null, error: null });
    await markComplete(SID, { safety: { tier: 'none', matchedLists: [] } });
    const upd = db.callsFor('product_sessions', 'update')[0].args[0] as Record<string, any>;
    expect(upd.is_complete).toBe(true);
    expect(upd.completed_at).toBeTruthy();
    expect(upd.session_data).toEqual({ variant: 'x', safety: { tier: 'none', matchedLists: [] } });

    db.reset();
    db.queue('product_sessions', { data: row({ completed_at: '2026-01-01T00:00:00Z' }), error: null }, { data: null, error: null });
    await markComplete(SID, {});
    const upd2 = db.callsFor('product_sessions', 'update')[0].args[0] as Record<string, any>;
    expect(upd2.completed_at).toBe('2026-01-01T00:00:00Z');
  });
});

describe('leads', () => {
  it('normalises emails', () => {
    expect(normaliseEmail('  Foo@Example.COM ')).toBe('foo@example.com');
    expect(normaliseEmail('nope')).toBeNull();
  });

  it('inserts a new lead with consent timestamp only when the box was ticked', async () => {
    db.queue('read_leads', { data: null, error: null }, {
      data: { id: 'L1', email: 'a@b.co', consent_marketing: true, consent_at: 'now', unsubscribed_at: null, utm: null, session_id: SID, pattern: 'SHOULDS', user_id: null },
      error: null,
    });
    const lead = await createLead({ email: 'A@B.co', consentMarketing: true, sessionId: SID, pattern: 'SHOULDS' });
    expect(lead).toMatchObject({ id: 'L1', consentMarketing: true, pattern: 'SHOULDS' });
    const ins = db.callsFor('read_leads', 'insert')[0].args[0] as Record<string, any>;
    expect(ins.email).toBe('a@b.co');
    expect(ins.consent_at).toBeTruthy();

    db.reset();
    db.queue('read_leads', { data: null, error: null }, { data: { id: 'L2', email: 'c@d.co', consent_marketing: false, consent_at: null }, error: null });
    await createLead({ email: 'c@d.co', consentMarketing: false, sessionId: SID, pattern: null });
    const ins2 = db.callsFor('read_leads', 'insert')[0].args[0] as Record<string, any>;
    expect(ins2.consent_marketing).toBe(false);
    expect(ins2.consent_at).toBeNull();
  });

  it('never withdraws earlier consent from an unticked box on an existing lead', async () => {
    db.queue(
      'read_leads',
      { data: { id: 'L1', email: 'a@b.co', consent_marketing: true, consent_at: 'then', unsubscribed_at: null, utm: { source: 'x' } }, error: null },
      { data: { id: 'L1', email: 'a@b.co', consent_marketing: true, consent_at: 'then' }, error: null }
    );
    await createLead({ email: 'a@b.co', consentMarketing: false, sessionId: SID, pattern: 'ON_EMPTY' });
    const patch = db.callsFor('read_leads', 'update')[0].args[0] as Record<string, any>;
    expect(patch).not.toHaveProperty('consent_marketing');
    expect(patch).not.toHaveProperty('utm');
    expect(patch.session_id).toBe(SID);
    expect(patch.pattern).toBe('ON_EMPTY');
  });

  it('re-consent after unsubscribe clears unsubscribed_at', async () => {
    db.queue(
      'read_leads',
      { data: { id: 'L1', email: 'a@b.co', consent_marketing: true, consent_at: 'then', unsubscribed_at: 'later', utm: null }, error: null },
      { data: { id: 'L1', email: 'a@b.co', consent_marketing: true }, error: null }
    );
    await createLead({ email: 'a@b.co', consentMarketing: true, sessionId: SID, pattern: null });
    const patch = db.callsFor('read_leads', 'update')[0].args[0] as Record<string, any>;
    expect(patch.unsubscribed_at).toBeNull();
    expect(patch.consent_at).toBeTruthy();
  });

  it('recovers from a unique-violation race', async () => {
    db.queue(
      'read_leads',
      { data: null, error: null },
      { data: null, error: { message: 'dup', code: '23505' } },
      { data: { id: 'L9', email: 'a@b.co', consent_marketing: false, unsubscribed_at: null, utm: null }, error: null },
      { data: { id: 'L9', email: 'a@b.co', consent_marketing: false }, error: null }
    );
    const lead = await createLead({ email: 'a@b.co', consentMarketing: false, sessionId: SID, pattern: null });
    expect(lead.id).toBe('L9');
  });
});

describe('recordEvent', () => {
  it('writes to product_events and never throws', async () => {
    db.queue('product_events', { data: null, error: null });
    await recordEvent({ event: 'read_start', sessionId: SID, step: 3, props: { a: 1 } });
    const ins = db.callsFor('product_events', 'insert')[0].args[0] as Record<string, any>;
    expect(ins).toMatchObject({ event: 'read_start', session_id: SID, step: '3', product_slug: 'perception-read', props: { a: 1 } });

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.queue('product_events', { data: null, error: { message: 'down' } });
    await expect(recordEvent({ event: 'read_start' })).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('eventContext carries pattern, segment tag and utm, and hides pattern for crisis', () => {
    const r = row({
      lead_id: 'L1',
      utm: { source: 'yt' },
      step_data: { q1: { questionId: 'q1', choice: ['seg:operator'] } },
      session_data: { scores: { pattern: 'SMALLER', scores: {} as any, lowSignal: false, reasons: [] } },
    });
    expect(eventContext(r)).toEqual({ leadId: 'L1', props: { pattern: 'SMALLER', segment: 'seg:operator', utm: { source: 'yt' } } });
    r.session_data!.safety = { tier: 'crisis', matchedLists: [] };
    expect(eventContext(r).props.pattern).toBeNull();
  });
});

describe('signed result links', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.READ_LINK_SECRET = 'x'.repeat(40);
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('round-trips and is bound to the session', () => {
    const t = signResultToken(SID);
    expect(verifyResultToken(SID, t)).toBe(true);
    expect(verifyResultToken(OTHER, t)).toBe(false);
    expect(verifyResultToken(SID, t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')))).toBe(false);
    expect(verifyResultToken(SID, 'garbage')).toBe(false);
    expect(verifyResultToken(SID, null)).toBe(false);
  });

  it('expires', () => {
    const t = signResultToken(SID, 60, Date.now() - 120_000);
    expect(verifyResultToken(SID, t)).toBe(false);
  });

  it('changes with the secret, and falls back to a key derived from the service role key', () => {
    const t = signResultToken(SID);
    process.env.READ_LINK_SECRET = 'y'.repeat(40);
    expect(verifyResultToken(SID, t)).toBe(false);
    delete process.env.READ_LINK_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-for-test';
    const t2 = signResultToken(SID);
    expect(verifyResultToken(SID, t2)).toBe(true);
  });

  it('builds an absolute result URL with the token', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.test/';
    const u = new URL(resultUrl(SID));
    expect(u.origin + u.pathname).toBe(`https://example.test/read/result/${SID}/`);
    expect(verifyResultToken(SID, u.searchParams.get('t'))).toBe(true);
  });
});
