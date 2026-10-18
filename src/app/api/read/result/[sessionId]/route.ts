import { NextRequest, NextResponse } from 'next/server';
import { eventContext, recordEvent } from '@/lib/read/store';
import { authorizeSession, jsonError, limit, logRouteError } from '../../_lib/http';
import { sessionIdSchema } from '../../_lib/validate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/read/result/[sessionId] → ReadResult
 * Access: the qs_read_token cookie, or ?t= (signed link from the result email).
 * 404 until the email gate has been passed.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const limited = limit(req, 'result', sessionId);
  if (limited) return limited;
  if (!sessionIdSchema.safeParse(sessionId).success) return jsonError(400, 'invalid_session');

  try {
    const auth = await authorizeSession(req, sessionId, { linkToken: req.nextUrl.searchParams.get('t') });
    if (!auth) return jsonError(403, 'forbidden');
    const result = auth.row.session_data?.result;
    if (!result) return jsonError(404, 'not_unlocked');

    const ctx = eventContext(auth.row);
    await recordEvent({ event: 'read_result_view', sessionId, leadId: ctx.leadId, props: { ...ctx.props, via: auth.via } });

    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    logRouteError('result', e);
    return jsonError(500, 'result_failed');
  }
}
