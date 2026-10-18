import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Chainable query fake: every builder method returns itself; awaiting pops the next result for the table. */
const results: Record<string, { data: unknown; error: unknown }[]> = {};
const calls: { table: string; method: string; args: unknown[] }[] = [];
function chain(table: string): any {
  const target: any = {
    then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
      const next = results[table]?.shift() ?? { data: [], error: null };
      return Promise.resolve(next).then(resolve, reject);
    },
  };
  return new Proxy(target, {
    get(t, prop: string) {
      if (prop === 'then') return t.then;
      return (...args: unknown[]) => {
        calls.push({ table, method: prop, args });
        return chain(table);
      };
    },
  });
}

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: { from: (table: string) => chain(table) } }));
vi.mock('../email-store', () => ({
  getLeadsByEmail: vi.fn(),
  getLeadBySession: vi.fn(),
  logReadEvent: vi.fn(async () => 'evt'),
}));

import { linkReadLeadsToUser, recordReadPurchase } from '../lead-link';
import { getLeadBySession, getLeadsByEmail, logReadEvent } from '../email-store';
import type { ReadLeadRow } from '../email-store';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const lead = (over: Partial<ReadLeadRow> = {}): ReadLeadRow => ({
  id: 'lead-1',
  email: 'Sam@Example.test',
  consent_marketing: true,
  session_id: SESSION_ID,
  pattern: 'SHOULDS',
  user_id: null,
  unsubscribed_at: null,
  created_at: '2026-10-10T00:00:00Z',
  ...over,
});

beforeEach(() => {
  for (const k of Object.keys(results)) delete results[k];
  calls.length = 0;
  vi.mocked(getLeadsByEmail).mockResolvedValue([lead()]);
  vi.mocked(getLeadBySession).mockResolvedValue(lead());
});

describe('linkReadLeadsToUser', () => {
  it('links unlinked leads with the same email and attaches the session when emails match', async () => {
    results.product_sessions = [{ data: [{ id: SESSION_ID }], error: null }];
    const out = await linkReadLeadsToUser({ userId: 'user-1', email: 'sam@example.test', sessionId: SESSION_ID });
    expect(out.linkedLeadIds).toEqual(['lead-1']);
    expect(out.sessionAttached).toBe(true);
    expect(calls).toContainEqual({ table: 'read_leads', method: 'update', args: [{ user_id: 'user-1' }] });
    expect(calls).toContainEqual({ table: 'product_sessions', method: 'update', args: [{ user_id: 'user-1' }] });
    expect(logReadEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_lead_linked', userId: 'user-1' }));
  });

  it("never attaches someone else's session", async () => {
    vi.mocked(getLeadsByEmail).mockResolvedValue([]);
    vi.mocked(getLeadBySession).mockResolvedValue(lead({ email: 'other@example.test' }));
    const out = await linkReadLeadsToUser({ userId: 'user-1', email: 'sam@example.test', sessionId: SESSION_ID });
    expect(out.sessionAttached).toBe(false);
    expect(calls.find((c) => c.table === 'product_sessions')).toBeUndefined();
  });

  it('leaves leads already linked to another user alone', async () => {
    vi.mocked(getLeadsByEmail).mockResolvedValue([lead({ user_id: 'someone-else' })]);
    vi.mocked(getLeadBySession).mockResolvedValue(null);
    const out = await linkReadLeadsToUser({ userId: 'user-1', email: 'sam@example.test', sessionId: SESSION_ID });
    expect(out.linkedLeadIds).toEqual([]);
    expect(calls.find((c) => c.table === 'read_leads')).toBeUndefined();
  });
});

describe('recordReadPurchase (webhook)', () => {
  const input = { email: 'sam@example.test', userId: 'user-1', productSlug: 'perception-rite-bundle', stripeSessionId: 'cs_1', amount: 12 };

  it('records read_purchase for a buyer with a lead', async () => {
    results.product_events = [{ data: [], error: null }];
    expect(await recordReadPurchase(input)).toBe(true);
    expect(logReadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'read_purchase',
        leadId: 'lead-1',
        userId: 'user-1',
        props: expect.objectContaining({ product_slug: 'perception-rite-bundle', amount: 12, stripe_session_id: 'cs_1' }),
      }),
    );
  });

  it('is idempotent across webhook retries', async () => {
    results.product_events = [{ data: [{ id: 'existing' }], error: null }];
    expect(await recordReadPurchase(input)).toBe(false);
    expect(logReadEvent).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'read_purchase' }));
  });

  it('does nothing for buyers who never took the Read', async () => {
    vi.mocked(getLeadsByEmail).mockResolvedValue([]);
    expect(await recordReadPurchase(input)).toBe(false);
    expect(logReadEvent).not.toHaveBeenCalled();
  });

  it('attributes to the bridge session when checkout came through /read/checkout with another email', async () => {
    vi.mocked(getLeadsByEmail).mockResolvedValue([]);
    vi.mocked(getLeadBySession).mockResolvedValue(lead({ id: 'bridge-lead', email: 'old@example.test' }));
    results.product_events = [{ data: [], error: null }];
    expect(await recordReadPurchase({ ...input, readSessionId: SESSION_ID })).toBe(true);
    expect(logReadEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_purchase', leadId: 'bridge-lead', props: expect.objectContaining({ via_bridge: true }) }));
  });
});
