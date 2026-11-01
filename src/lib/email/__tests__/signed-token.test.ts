import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { b64url, decodeSignedToken, encodeSignedToken } from '../signed-token';

beforeAll(() => {
  process.env.READ_LINK_SECRET = 'test-secret';
});

describe('signed-token', () => {
  it('round-trips a payload', () => {
    expect(decodeSignedToken(encodeSignedToken({ a: 1 }))).toEqual({ a: 1 });
  });

  it('matches the original Read link format exactly when no purpose is given', () => {
    // Links already sent were signed as HMAC(secret, body). They must keep verifying.
    const body = b64url(Buffer.from(JSON.stringify({ k: 'u', l: 'x' }), 'utf8'));
    const legacy = `${body}.${b64url(createHmac('sha256', 'test-secret').update(body).digest())}`;
    expect(encodeSignedToken({ k: 'u', l: 'x' })).toBe(legacy);
  });

  it('keeps purposes apart', () => {
    const t = encodeSignedToken({ a: 1 }, 'email-prefs');
    expect(decodeSignedToken(t, 'email-prefs')).toEqual({ a: 1 });
    expect(decodeSignedToken(t)).toBeNull();
    expect(decodeSignedToken(encodeSignedToken({ a: 1 }), 'email-prefs')).toBeNull();
  });

  it('rejects tampering and junk', () => {
    const [body, sig] = encodeSignedToken({ a: 1 }).split('.');
    const forged = b64url(Buffer.from(JSON.stringify({ a: 2 }), 'utf8'));
    expect(decodeSignedToken(`${forged}.${sig}`)).toBeNull();
    expect(decodeSignedToken(`${body}.`)).toBeNull();
    expect(decodeSignedToken(42)).toBeNull();
    expect(decodeSignedToken('x'.repeat(2000))).toBeNull();
  });
});
