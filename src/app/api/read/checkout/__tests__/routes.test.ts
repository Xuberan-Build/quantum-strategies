import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const auth = {
  getUser: vi.fn(),
  signInWithOtp: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {},
  createServerSupabaseClient: vi.fn(async () => ({ auth })),
}));
vi.mock('@/lib/read/lead-link', () => ({
  linkReadLeadsToUser: vi.fn(async () => ({ linkedLeadIds: ['l1'], sessionAttached: true, sessionLead: null })),
  recordReadCheckoutStarted: vi.fn(async () => undefined),
}));
vi.mock('@/lib/read/email-store', () => ({ getLeadBySession: vi.fn() }));
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 1, resetAt: 0 })) }));
vi.mock('@/lib/config/urls', () => ({ APP_URL: 'https://app.example.test' }));

import { POST as start } from '../route';
import { POST as link } from '../link/route';
import { linkReadLeadsToUser, recordReadCheckoutStarted } from '@/lib/read/lead-link';
import { getLeadBySession } from '@/lib/read/email-store';
import { checkRateLimit } from '@/lib/security/rate-limit';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const json = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  auth.getUser.mockResolvedValue({ data: { user: null } });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  vi.mocked(getLeadBySession).mockResolvedValue({
    id: 'lead',
    email: 'sam@example.test',
    consent_marketing: false,
    session_id: SESSION_ID,
    pattern: 'SHOULDS',
    user_id: null,
    unsubscribed_at: null,
    created_at: '2026-10-18T00:00:00Z',
  });
});

describe('POST /api/read/checkout (bridge, step 1)', () => {
  it('signed in: links the lead and session, records read_checkout_started', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'sam@example.test' } } });
    const res = await start(json('http://localhost/api/read/checkout', { sessionId: SESSION_ID }));
    expect(res.status).toBe(200);
    expect(linkReadLeadsToUser).toHaveBeenCalledWith({ userId: 'user-1', email: 'sam@example.test', sessionId: SESSION_ID });
    expect(recordReadCheckoutStarted).toHaveBeenCalledWith({ userId: 'user-1', email: 'sam@example.test', sessionId: SESSION_ID });
  });

  it('signed in: link or event failures never block checkout', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'sam@example.test' } } });
    vi.mocked(linkReadLeadsToUser).mockRejectedValueOnce(new Error('db'));
    vi.mocked(recordReadCheckoutStarted).mockRejectedValueOnce(new Error('db'));
    const res = await start(json('http://localhost/x', { sessionId: SESSION_ID }));
    expect(res.status).toBe(200);
  });

  it('signed out: 401 needsSignIn, nothing recorded', async () => {
    const res = await start(json('http://localhost/x', { sessionId: SESSION_ID }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ needsSignIn: true });
    expect(linkReadLeadsToUser).not.toHaveBeenCalled();
  });

  it('rejects a bad session id', async () => {
    expect((await start(json('http://localhost/x', { sessionId: 'nope' }))).status).toBe(400);
  });
});

describe('POST /api/read/checkout/link (magic link)', () => {
  it("sends a magic link to the lead's email that returns to the bridge, and never returns the address", async () => {
    const res = await link(json('http://localhost/api/read/checkout/link', { sessionId: SESSION_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, maskedEmail: 'sa*@example.test'.replace('*', '***') });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'sam@example.test',
      options: {
        emailRedirectTo: `https://app.example.test/api/auth/callback?next=${encodeURIComponent(`/read/checkout/?session=${SESSION_ID}`)}`,
        shouldCreateUser: true,
      },
    });
  });

  it('404s when the session has no lead', async () => {
    vi.mocked(getLeadBySession).mockResolvedValueOnce(null);
    expect((await link(json('http://localhost/x', { sessionId: SESSION_ID }))).status).toBe(404);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('rate limits', async () => {
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: 0 });
    expect((await link(json('http://localhost/x', { sessionId: SESSION_ID }))).status).toBe(429);
  });

  it('502s when Supabase refuses', async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ error: { message: 'smtp' } });
    expect((await link(json('http://localhost/x', { sessionId: SESSION_ID }))).status).toBe(502);
  });
});
