/**
 * Social publisher cron, daily at 14:00 UTC (vercel.json; Hobby plan allows daily crons only). Publishes due posts, polls async uploads, syncs metrics.
 * Local: curl http://localhost:3000/api/cron/social-publish -H "Authorization: Bearer $CRON_SECRET"
 */
import { NextRequest, NextResponse } from 'next/server';
import { runPublisher } from '@/lib/social/engine';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const summary = await runPublisher({ client: supabaseAdmin, now: new Date(), budgetMs: 240_000 });
    console.log('[social-publish] done:', summary);
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    console.error('[social-publish] run failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Social publish run failed' }, { status: 500 });
  }
}
