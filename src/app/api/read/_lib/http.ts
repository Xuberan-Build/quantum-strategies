/**
 * Shared helpers for /api/read/* (private folder: not a route).
 *
 * Rate limits use the repo's in-memory limiter (src/lib/security/rate-limit.ts): per server
 * instance, reset on cold start. Good enough to stop casual abuse of an anonymous funnel;
 * put a Vercel WAF rule on /api/read/* if traffic ever needs a global cap.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security/rate-limit';
import {
  READ_TOKEN_COOKIE,
  READ_TOKEN_MAX_AGE_S,
  verifyReadToken,
  verifyResultToken,
  getReadSession,
  isUuid,
  type ReadSessionRow,
} from '@/lib/read/store';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Per route: [per-IP limit, per-session limit]. Session limit is null where there is no session. */
export const READ_RATE_LIMITS = {
  start: { ip: { maxRequests: 20, windowMs: HOUR }, session: null },
  questions: { ip: { maxRequests: 60, windowMs: MIN }, session: null },
  answer: { ip: { maxRequests: 120, windowMs: MIN }, session: { maxRequests: 60, windowMs: MIN } },
  complete: { ip: { maxRequests: 20, windowMs: MIN }, session: { maxRequests: 10, windowMs: MIN } },
  unlock: { ip: { maxRequests: 10, windowMs: HOUR }, session: { maxRequests: 5, windowMs: HOUR } },
  result: { ip: { maxRequests: 60, windowMs: MIN }, session: { maxRequests: 30, windowMs: MIN } },
  event: { ip: { maxRequests: 240, windowMs: MIN }, session: { maxRequests: 120, windowMs: MIN } },
  feedback: { ip: { maxRequests: 20, windowMs: MIN }, session: { maxRequests: 10, windowMs: MIN } },
} as const;

export type ReadRoute = keyof typeof READ_RATE_LIMITS;

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra ?? {}) }, { status });
}

function tooMany(resetAt: number) {
  const retry = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(retry) } });
}

/** Returns a 429 response when over the IP (and, if given, session) limit, else null. */
export function limit(req: NextRequest, route: ReadRoute, sessionId?: string | null): NextResponse | null {
  const cfg = READ_RATE_LIMITS[route];
  const ipCheck = checkRateLimit(`read:${route}:ip:${clientIp(req)}`, cfg.ip);
  if (!ipCheck.allowed) return tooMany(ipCheck.resetAt);
  if (cfg.session && isUuid(sessionId)) {
    const sCheck = checkRateLimit(`read:${route}:s:${sessionId}`, cfg.session);
    if (!sCheck.allowed) return tooMany(sCheck.resetAt);
  }
  return null;
}

/** The sessionId field of an unparsed body, for rate-limit keys only. */
export function bodySessionId(body: unknown): string | null {
  const v = (body as { sessionId?: unknown } | null | undefined)?.sessionId;
  return isUuid(v) ? v : null;
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function readTokenFrom(req: NextRequest): string | null {
  return req.cookies.get(READ_TOKEN_COOKIE)?.value ?? null;
}

export function setReadTokenCookie(res: NextResponse, token: string) {
  res.cookies.set(READ_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: READ_TOKEN_MAX_AGE_S,
  });
}

/**
 * Authorise access to a Read session: the cookie token, or (when allowed) a signed
 * result-link token `t`. Returns the session row, or null.
 */
export async function authorizeSession(
  req: NextRequest,
  sessionId: string,
  opts: { linkToken?: string | null } = {}
): Promise<{ row: ReadSessionRow; via: 'cookie' | 'link' } | null> {
  const cookieRow = await verifyReadToken(sessionId, readTokenFrom(req));
  if (cookieRow) return { row: cookieRow, via: 'cookie' };
  if (opts.linkToken && verifyResultToken(sessionId, opts.linkToken)) {
    const row = await getReadSession(sessionId);
    if (row) return { row, via: 'link' };
  }
  return null;
}

/** Logs an error without request bodies (which may hold answer text or emails). */
export function logRouteError(route: string, e: unknown) {
  console.error(`[api/read/${route}] ${(e as Error)?.message ?? 'unknown error'}`);
}
