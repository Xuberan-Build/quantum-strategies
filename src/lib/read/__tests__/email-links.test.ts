import { describe, it, expect, beforeAll } from 'vitest';
import {
  answerPageUrl,
  bridgeCallbackUrl,
  maskEmail,
  signReadLink,
  unsubscribePageUrl,
  verifyReadLink,
  ANSWER_LINK_TTL_MS,
} from '../email-links';
import { APP, LEAD_ID, SESSION_ID } from './email-fixtures';

beforeAll(() => {
  process.env.READ_LINK_SECRET = 'test-secret';
});

describe('signed Read links', () => {
  it('round-trips unsubscribe and answer tokens', () => {
    expect(verifyReadLink(signReadLink({ kind: 'unsubscribe', leadId: LEAD_ID }))).toEqual({ kind: 'unsubscribe', leadId: LEAD_ID });
    const t = signReadLink({ kind: 'answer', leadId: LEAD_ID, question: 'pmf', value: 'very', expiresAt: Date.now() + 1000 });
    expect(verifyReadLink(t)).toMatchObject({ kind: 'answer', question: 'pmf', value: 'very' });
  });

  it('rejects tampered, foreign-secret, malformed and expired tokens', () => {
    const t = signReadLink({ kind: 'unsubscribe', leadId: LEAD_ID });
    const [body, sig] = t.split('.');
    const otherBody = Buffer.from(JSON.stringify({ k: 'u', l: SESSION_ID })).toString('base64url');
    expect(verifyReadLink(`${otherBody}.${sig}`)).toBeNull();
    expect(verifyReadLink(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(verifyReadLink('nope')).toBeNull();
    expect(verifyReadLink(undefined)).toBeNull();

    const expired = signReadLink({ kind: 'answer', leadId: LEAD_ID, question: 'move', value: 'yes', expiresAt: 1 });
    expect(verifyReadLink(expired)).toBeNull();

    process.env.READ_LINK_SECRET = 'another-secret';
    expect(verifyReadLink(t)).toBeNull();
    process.env.READ_LINK_SECRET = 'test-secret';
  });

  it('rejects answers outside the allowed values', () => {
    const bad = signReadLink({ kind: 'answer', leadId: LEAD_ID, question: 'rerate', value: '11', expiresAt: Date.now() + 1000 });
    expect(verifyReadLink(bad)).toBeNull();
  });

  it('builds page URLs on the app host with a 30-day answer expiry', () => {
    const now = Date.now();
    const u = new URL(answerPageUrl(APP, LEAD_ID, 'rerate', '7', now));
    expect(u.origin + u.pathname).toBe(`${APP}/read/email/answer/`);
    expect(verifyReadLink(u.searchParams.get('t'), now)).toMatchObject({ expiresAt: now + ANSWER_LINK_TTL_MS, value: '7' });
    expect(unsubscribePageUrl(APP, LEAD_ID)).toMatch(`${APP}/read/email/unsubscribe/?t=`);
  });

  it('masks emails and builds the magic-link callback', () => {
    expect(maskEmail('samantha@example.test')).toBe('sa******@example.test');
    expect(maskEmail('a@x.test')).toBe('a***@x.test');
    expect(bridgeCallbackUrl(APP, SESSION_ID)).toBe(
      `${APP}/api/auth/callback?next=${encodeURIComponent(`/read/checkout/?session=${SESSION_ID}`)}`,
    );
  });
});
