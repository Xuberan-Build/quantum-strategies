import { NextRequest, NextResponse } from 'next/server';
import { eventContext, recordEvent } from '@/lib/read/store';
import { authorizeSession, bodySessionId, jsonError, limit, logRouteError, readJson } from '../_lib/http';
import { SESSIONLESS_READ_EVENTS, eventBodySchema, zodIssues } from '../_lib/validate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/read/event { sessionId?, t?, event, step?, props? } → 204
 * Client-sendable events only (CLIENT_READ_EVENTS); the rest are recorded server-side.
 * Without a sessionId only read_view_landing is accepted. With one, the caller must hold the
 * session cookie or a signed link token `t`, else 403.
 * props: tags, counts and ids only (strings ≤ 200 chars). Never answer text.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const limited = limit(req, 'event', bodySessionId(body));
  if (limited) return limited;

  const parsed = eventBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'invalid_body', { issues: zodIssues(parsed.error) });
  const { sessionId, t, event, step, props } = parsed.data;

  try {
    if (!sessionId) {
      if (!SESSIONLESS_READ_EVENTS.includes(event)) return jsonError(400, 'session_required');
      await recordEvent({ event, step, props: props ?? {} });
      return new NextResponse(null, { status: 204 });
    }
    const auth = await authorizeSession(req, sessionId, { linkToken: t });
    if (!auth) return jsonError(403, 'forbidden');
    const ctx = eventContext(auth.row);
    await recordEvent({ event, sessionId, leadId: ctx.leadId, step, props: { ...ctx.props, ...(props ?? {}) } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    logRouteError('event', e);
    return jsonError(500, 'event_failed');
  }
}
