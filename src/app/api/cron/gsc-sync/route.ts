/**
 * Search Console daily sync. Daily via Vercel Cron (vercel.json).
 *
 * Re-fetches the last 5 complete days of search analytics (site, page and query rows), refreshes the
 * query/page -> topic maps from the topical map, and inspects up to 100 sitemap URLs (never-inspected first,
 * then the stalest). Idempotent: rows upsert on (date, query, page, country, device).
 *
 * Backfill (16 months) runs locally: npx tsx scripts/seo/gsc-sync.ts --backfill
 * Local: curl http://localhost:3000/api/cron/gsc-sync -H "Authorization: Bearer $CRON_SECRET"
 */
import { NextRequest, NextResponse } from 'next/server';
import { createGscApi, gscConfigFromEnv } from '@/lib/seo/gsc';
import { runGscSync } from '@/lib/seo/gsc-sync';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = gscConfigFromEnv();
  if (!cfg.siteUrl || !cfg.credentials) {
    console.warn('[gsc-sync] not configured:', { siteUrl: !!cfg.siteUrl, credentials: !!cfg.credentials });
    return NextResponse.json({ skipped: 'Search Console is not configured (GSC_SITE_URL and service account env)' });
  }

  try {
    const result = await runGscSync({
      client: supabaseAdmin,
      api: await createGscApi(cfg.credentials),
      siteUrl: cfg.siteUrl,
      mode: 'daily',
      inspectBudget: 100,
    });
    console.log('[gsc-sync] done:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[gsc-sync] run failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Search Console sync failed' }, { status: 500 });
  }
}
