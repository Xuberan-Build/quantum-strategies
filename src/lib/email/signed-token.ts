/**
 * Signed tokens for links in email: base64url(JSON) + "." + base64url(HMAC-SHA256).
 * Trusted without a database lookup. Server-only (node:crypto).
 *
 * Secret: READ_LINK_SECRET. If it isn't set, a key is derived from
 * SUPABASE_SERVICE_ROLE_KEY so links still work (rotating that key invalidates them).
 *
 * `purpose` separates token families: a token signed for one purpose never verifies
 * for another. No purpose = the original Perception Read key, so links already sent
 * keep working.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MAX_TOKEN_LENGTH = 1024;

function baseSecret(): Buffer {
  const explicit = process.env.READ_LINK_SECRET?.trim();
  if (explicit) return Buffer.from(explicit, 'utf8');
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) return createHash('sha256').update(`qs-read-links:${service}`).digest();
  throw new Error('READ_LINK_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is not configured');
}

function keyFor(purpose?: string): Buffer {
  const base = baseSecret();
  return purpose ? createHmac('sha256', base).update(`purpose:${purpose}`).digest() : base;
}

export function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(body: string, purpose?: string): string {
  return b64url(createHmac('sha256', keyFor(purpose)).update(body).digest());
}

export function encodeSignedToken(payload: unknown, purpose?: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body, purpose)}`;
}

/** The decoded JSON when the signature is valid, else null. Never throws. Callers validate the shape. */
export function decodeSignedToken(token: unknown, purpose?: string): unknown {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;

  let expected: string;
  try {
    expected = sign(body, purpose);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }
}
