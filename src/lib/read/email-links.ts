/**
 * The Perception Read: signed links for email (unsubscribe, day-7 one-click answers).
 *
 * A token is base64url(JSON payload) + "." + base64url(HMAC-SHA256). No DB lookup is
 * needed to trust it. Server-only (node:crypto).
 *
 * Secret: READ_LINK_SECRET. If it isn't set, a key is derived from
 * SUPABASE_SERVICE_ROLE_KEY (always present on the server) so links still work, and
 * rotating that key invalidates old links. Set READ_LINK_SECRET in production.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type ReadLinkKind = 'unsubscribe' | 'answer';

/** Day-7 questions answered by one click. */
export type ReadAnswerQuestion = 'pmf' | 'rerate' | 'move';

export const READ_ANSWER_VALUES: Record<ReadAnswerQuestion, readonly string[]> = {
  pmf: ['very', 'somewhat', 'not', 'have_it'],
  rerate: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  move: ['yes', 'started_stopped', 'no'],
};

export interface UnsubscribePayload {
  kind: 'unsubscribe';
  leadId: string;
}

export interface AnswerPayload {
  kind: 'answer';
  leadId: string;
  question: ReadAnswerQuestion;
  value: string;
  /** Expiry, ms since epoch. */
  expiresAt: number;
}

export type ReadLinkPayload = UnsubscribePayload | AnswerPayload;

/** Answer links work for 30 days. Unsubscribe links never expire. */
export const ANSWER_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function getSecret(): Buffer {
  const explicit = process.env.READ_LINK_SECRET?.trim();
  if (explicit) return Buffer.from(explicit, 'utf8');
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) return createHash('sha256').update(`qs-read-links:${service}`).digest();
  throw new Error('READ_LINK_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is not configured');
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(body: string): string {
  return b64url(createHmac('sha256', getSecret()).update(body).digest());
}

/** Compact wire format so links stay short. */
interface Wire {
  k: 'u' | 'a';
  l: string;
  q?: ReadAnswerQuestion;
  v?: string;
  x?: number;
}

export function signReadLink(payload: ReadLinkPayload): string {
  const wire: Wire =
    payload.kind === 'unsubscribe'
      ? { k: 'u', l: payload.leadId }
      : { k: 'a', l: payload.leadId, q: payload.question, v: payload.value, x: payload.expiresAt };
  const body = b64url(Buffer.from(JSON.stringify(wire), 'utf8'));
  return `${body}.${sign(body)}`;
}

/** Returns the payload when the token is authentic, well-formed and unexpired. Never throws. */
export function verifyReadLink(token: unknown, now: number = Date.now()): ReadLinkPayload | null {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;
  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let wire: Wire;
  try {
    wire = JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }
  if (!wire || !isUuid(wire.l)) return null;

  if (wire.k === 'u') return { kind: 'unsubscribe', leadId: wire.l };
  if (wire.k === 'a') {
    const q = wire.q;
    if (!q || !(q in READ_ANSWER_VALUES)) return null;
    if (typeof wire.v !== 'string' || !READ_ANSWER_VALUES[q].includes(wire.v)) return null;
    if (typeof wire.x !== 'number' || wire.x < now) return null;
    return { kind: 'answer', leadId: wire.l, question: q, value: wire.v, expiresAt: wire.x };
  }
  return null;
}

/** Page the email links to. It confirms with a POST so link scanners can't unsubscribe anyone. */
export function unsubscribePageUrl(appUrl: string, leadId: string): string {
  const u = new URL('/read/email/unsubscribe/', appUrl);
  u.searchParams.set('t', signReadLink({ kind: 'unsubscribe', leadId }));
  return u.toString();
}

/** RFC 8058 one-click endpoint for the List-Unsubscribe header (mail clients POST to it). */
export function unsubscribeOneClickUrl(appUrl: string, leadId: string): string {
  const u = new URL('/api/read/email/unsubscribe', appUrl);
  u.searchParams.set('t', signReadLink({ kind: 'unsubscribe', leadId }));
  return u.toString();
}

export function answerPageUrl(
  appUrl: string,
  leadId: string,
  question: ReadAnswerQuestion,
  value: string,
  now: number = Date.now(),
): string {
  const u = new URL('/read/email/answer/', appUrl);
  u.searchParams.set('t', signReadLink({ kind: 'answer', leadId, question, value, expiresAt: now + ANSWER_LINK_TTL_MS }));
  return u.toString();
}

/** "jo****@example.com". The full address never goes to the browser. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || !local) return '***';
  const head = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${head}${'*'.repeat(Math.max(3, local.length - head.length))}@${domain}`;
}

/** Where the magic link lands: the auth callback, which then returns to the bridge. */
export function bridgeCallbackUrl(origin: string, sessionId: string): string {
  const next = `/read/checkout/?session=${sessionId}`;
  return `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
}

/** The checkout bridge for a Read session. */
export function readCheckoutUrl(appUrl: string, sessionId: string): string {
  const u = new URL('/read/checkout/', appUrl);
  u.searchParams.set('session', sessionId);
  return u.toString();
}
