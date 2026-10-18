/**
 * Perception Read follow-ups (day 2 and day 7). Daily via Vercel Cron (vercel.json).
 *
 * Selects consented, not-unsubscribed read_leads whose age falls in each email's
 * window, skips anything already claimed or sent (product_events read_email_sent),
 * and sends one series per email address. Safe to run more than once a day.
 *
 * Local: curl http://localhost:3000/api/cron/read-followups -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { runReadFollowups } from '@/lib/read/emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runReadFollowups();
    if (result.errors.length) console.warn('[read-followups] errors:', result.errors.slice(0, 20));
    console.log('[read-followups] done:', { ...result, errors: result.errors.length });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[read-followups] run failed:', err?.message);
    return NextResponse.json({ error: 'Follow-up run failed' }, { status: 500 });
  }
}
