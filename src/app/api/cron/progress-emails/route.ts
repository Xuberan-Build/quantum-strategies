/**
 * Progress emails and the founder "people to call" digest. Daily via Vercel Cron (vercel.json).
 * Does nothing until PROGRESS_EMAIL_MODE is preview or send. Safe to run more than once a day.
 *
 * Local: curl http://localhost:3000/api/cron/progress-emails -H "Authorization: Bearer $CRON_SECRET"
 */
import { NextRequest, NextResponse } from 'next/server';
import { runProgressEmails } from '@/lib/progress-emails/run';
import { errorMessage } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runProgressEmails();
    if (result.errors.length) console.warn('[progress-emails] errors:', result.errors.slice(0, 20));
    console.log('[progress-emails] done:', { ...result, errors: result.errors.length });
    return NextResponse.json({ success: true, ...result, errors: result.errors.length });
  } catch (err) {
    console.error('[progress-emails] run failed:', errorMessage(err));
    return NextResponse.json({ error: 'Progress email run failed' }, { status: 500 });
  }
}
