import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createReadSession, recordEvent } from '@/lib/read/store';
import { READ_PRODUCT_SLUG } from '@/lib/read/types';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { jsonError, limit, logRouteError, readJson, setReadTokenCookie } from '../_lib/http';
import { startSchema, zodIssues } from '../_lib/validate';

export const dynamic = 'force-dynamic';

/** POST /api/read/start { utm?, variant? } → { sessionId } + httpOnly qs_read_token cookie. */
export async function POST(req: NextRequest) {
  const limited = limit(req, 'start');
  if (limited) return limited;

  const parsed = startSchema.safeParse((await readJson(req)) ?? undefined);
  if (!parsed.success) return jsonError(400, 'invalid_body', { issues: zodIssues(parsed.error) });
  const utm = parsed.data?.utm;
  const variant = parsed.data?.variant ?? utm?.variant ?? null;

  try {
    // Kill switch: the product row must exist and be active.
    const { data: product, error } = await supabaseAdmin
      .from('product_definitions')
      .select('product_slug, is_active')
      .eq('product_slug', READ_PRODUCT_SLUG)
      .maybeSingle();
    if (error) throw new Error(error.message);
    // While the Read is switched off, a signed-in admin can still run it to test.
    // Those sessions are tagged so they can be filtered out of real data.
    let sessionVariant = variant;
    if (!product?.is_active) {
      const { admin } = await validateAdminApiRequest();
      if (!admin) return jsonError(503, 'read_unavailable');
      sessionVariant = 'admin-preview';
    }

    const { sessionId, token } = await createReadSession(utm ?? null, sessionVariant);
    await recordEvent({ event: 'read_start', sessionId, props: { utm: utm ?? null, variant: sessionVariant } });

    const res = NextResponse.json({ sessionId });
    setReadTokenCookie(res, token);
    return res;
  } catch (e) {
    logRouteError('start', e);
    return jsonError(500, 'start_failed');
  }
}
