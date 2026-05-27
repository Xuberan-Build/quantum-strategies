/**
 * GET /api/cron/portrait-extraction-queue
 *
 * Canonical drainage path for portrait_update_queue. Triggered by the
 * GitHub Actions workflow at .github/workflows/portrait-extraction.yml,
 * which runs every 5 minutes. Do NOT call processPortraitUpdate from any
 * HTTP request handler or other background job — enqueue into
 * portrait_update_queue and let this worker drain it.
 *
 * Why GitHub Actions and not Vercel Cron: Vercel's Hobby plan caps cron
 * cadence to once per day with ±59-minute jitter. Once the project is on
 * Pro and a 5-minute Vercel cron entry is added back to vercel.json, this
 * same route serves that trigger too — the auth check accepts any caller
 * with the correct CRON_SECRET bearer.
 *
 * Batch size: up to CLAIM_LIMIT rows per invocation (currently 5), processed
 * sequentially so OpenAI rate limits are spread across runs.
 *
 * Stuck-row reclaim policy: any row with status='processing' whose
 * processing_started_at is older than STUCK_THRESHOLD_MS (5 minutes) is
 * considered dead (e.g. the previous cron invocation timed out). Dead rows
 * are reset to status='pending' WITHOUT incrementing attempts — the previous
 * worker never finished, so the fault is the cron's, not the data's.
 *
 * Failure handling: rows where attempts >= max_attempts are permanently
 * failed (status='failed') without calling the worker. This matches the
 * max_attempts guard inside processPortraitUpdate itself.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> header required. CRON_SECRET
 * must be set in BOTH:
 *   - Vercel environment variables (used by this route at runtime)
 *   - GitHub Actions repository secrets (used by the workflow caller)
 * The two MUST match. A separate PRODUCTION_URL secret in GitHub Actions
 * points the workflow at the deployed Vercel URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { processPortraitUpdate } from '@/lib/portraits/worker';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum queue rows to claim and process in one cron invocation. */
const CLAIM_LIMIT = 5;

/**
 * Rows stuck in 'processing' for longer than this are considered dead
 * and reset to 'pending'. No attempt increment on dead reclaim.
 */
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueRow {
  id: string;
  briefing_id: string;
  user_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  processing_started_at: string | null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // ------------------------------------------------------------------
  // Auth: Bearer <CRON_SECRET>. Matches the pattern used by all other
  // cron routes in this project (see extract-insights, process-campaigns).
  // ------------------------------------------------------------------
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const stuckCutoff = new Date(now.getTime() - STUCK_THRESHOLD_MS).toISOString();

  let stuckReset = 0;
  let claimed = 0;
  let completed = 0;
  let failed = 0;

  // ------------------------------------------------------------------
  // Step 1: Reclaim stuck rows (status='processing' older than 5 min).
  // Reset to 'pending' WITHOUT incrementing attempts — the worker never
  // finished, so this is the cron's fault, not the data's.
  // ------------------------------------------------------------------
  const { data: stuckRows, error: stuckFetchError } = await supabaseAdmin
    .from('portrait_update_queue')
    .select('id')
    .eq('status', 'processing')
    .lt('processing_started_at', stuckCutoff);

  if (stuckFetchError) {
    console.error('[cron/portrait-extraction-queue] Failed to fetch stuck rows:', stuckFetchError);
    // Non-fatal — proceed to claim pending rows.
  } else if (stuckRows && stuckRows.length > 0) {
    const stuckIds = stuckRows.map((r: { id: string }) => r.id);

    const { error: resetError } = await supabaseAdmin
      .from('portrait_update_queue')
      .update({
        status: 'pending',
        processing_started_at: null,
      })
      .in('id', stuckIds);

    if (resetError) {
      console.error('[cron/portrait-extraction-queue] Failed to reset stuck rows:', resetError);
    } else {
      stuckReset = stuckIds.length;
      console.error(
        `[cron/portrait-extraction-queue] Reset ${stuckReset} stuck row(s) to pending`,
      );
    }
  }

  // ------------------------------------------------------------------
  // Step 2: Claim up to CLAIM_LIMIT pending rows.
  // ------------------------------------------------------------------
  const { data: pendingRows, error: claimFetchError } = await supabaseAdmin
    .from('portrait_update_queue')
    .select('id, briefing_id, user_id, status, attempts, max_attempts, processing_started_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(CLAIM_LIMIT);

  if (claimFetchError) {
    console.error('[cron/portrait-extraction-queue] Failed to fetch pending rows:', claimFetchError);
    return NextResponse.json({ error: claimFetchError.message }, { status: 500 });
  }

  const rows = (pendingRows ?? []) as QueueRow[];
  claimed = rows.length;

  // ------------------------------------------------------------------
  // Step 3: Process each claimed row sequentially.
  // Sequential (not parallel) so that rate limits accumulate across
  // invocations rather than within one. When multi-worker support is
  // needed, switch to FOR UPDATE SKIP LOCKED on the SELECT above and
  // parallelize here with Promise.allSettled.
  // ------------------------------------------------------------------
  for (const row of rows) {
    // Permanently fail rows that have exhausted their retries without
    // calling the worker. processPortraitUpdate has an identical guard,
    // but checking here avoids an unnecessary function call and keeps
    // the failure reason in the cron log.
    if (row.attempts >= row.max_attempts) {
      console.error(
        '[cron/portrait-extraction-queue] Skipping row', row.id,
        '— attempts', row.attempts, '>= max_attempts', row.max_attempts,
      );
      const { error: failError } = await supabaseAdmin
        .from('portrait_update_queue')
        .update({
          status: 'failed',
          error_message: `Exhausted max_attempts (${row.max_attempts}) without successful extraction`,
          processed_at: now.toISOString(),
        })
        .eq('id', row.id);

      if (failError) {
        console.error('[cron/portrait-extraction-queue] Failed to mark row as failed:', failError);
      }
      failed++;
      continue;
    }

    // Mark as processing before handing off to the worker.
    const { error: claimError } = await supabaseAdmin
      .from('portrait_update_queue')
      .update({
        status: 'processing',
        processing_started_at: now.toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending'); // optimistic: skip if another worker already claimed it

    if (claimError) {
      console.error(
        '[cron/portrait-extraction-queue] Failed to claim row', row.id, ':', claimError,
      );
      continue;
    }

    try {
      await processPortraitUpdate(row.id);
      completed++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        '[cron/portrait-extraction-queue] Worker threw for row', row.id, ':', message,
      );
      // processPortraitUpdate catches its own errors and writes status='failed'
      // to the queue row. If it throws here it's an unexpected error; count it
      // but don't re-throw (we want to continue processing other rows).
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // Step 4: Count remaining pending rows for observability.
  // ------------------------------------------------------------------
  const { count: remainingPending } = await supabaseAdmin
    .from('portrait_update_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return NextResponse.json({
    claimed,
    completed,
    failed,
    stuck_reset: stuckReset,
    remaining_pending: remainingPending ?? 0,
  });
}

export const dynamic = 'force-dynamic';
