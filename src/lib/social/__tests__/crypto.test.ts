import { randomBytes } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, pkcePair, randomState } from '../crypto';

describe('social crypto', () => {
  beforeAll(() => {
    process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString('base64');
  });

  it('round-trips and never stores plaintext', () => {
    const enc = encryptToken('secret-token-123')!;
    expect(enc.startsWith('v1.')).toBe(true);
    expect(enc).not.toContain('secret-token-123');
    expect(decryptToken(enc)).toBe('secret-token-123');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'));
  });

  it('handles empty values', () => {
    expect(encryptToken(null)).toBeNull();
    expect(encryptToken('')).toBeNull();
    expect(decryptToken(null)).toBeNull();
  });

  it('rejects tampered ciphertext and bad formats', () => {
    const enc = encryptToken('abc')!;
    const parts = enc.split('.');
    parts[3] = Buffer.from('tampered!!').toString('base64');
    expect(() => decryptToken(parts.join('.'))).toThrow();
    expect(() => decryptToken('garbage')).toThrow();
  });

  it('fails without a valid key', () => {
    const saved = process.env.SOCIAL_TOKEN_KEY;
    process.env.SOCIAL_TOKEN_KEY = Buffer.from('short').toString('base64');
    expect(() => encryptToken('x')).toThrow(/32 bytes/);
    delete process.env.SOCIAL_TOKEN_KEY;
    expect(() => encryptToken('x')).toThrow(/not set/);
    process.env.SOCIAL_TOKEN_KEY = saved;
  });

  it('produces PKCE pairs and random states', () => {
    const a = pkcePair();
    expect(a.verifier.length).toBeGreaterThan(40);
    expect(a.challenge).not.toBe(a.verifier);
    expect(randomState()).not.toBe(randomState());
  });
});
