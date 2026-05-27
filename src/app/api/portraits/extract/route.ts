/**
 * POST /api/portraits/extract
 *
 * Enqueues portrait extraction for a given briefing. Internal endpoint —
 * accessible to admins and service-role callers only; never exposed to
 * end-users directly.
 *
 * Auth: Admin session (email in ADMIN_EMAILS) OR x-service-role-key header
 * matching SUPABASE_SERVICE_ROLE_KEY. The endpoint validates one of the two
 * before processing.
 *
 * Body: { briefingId: string; force?: boolean }
 *
 * Async model: this endpoint is enqueue-only. The OpenAI extraction call
 * and all DB writes happen asynchronously in the cron worker at
 * /api/cron/portrait-extraction-queue, which runs every 5 minutes.
 * The synchronous processPortraitUpdate() call was removed — this endpoint
 * now returns in <200 ms regardless of OpenAI latency.
 *
 * Manual test (replace values with real data):
 *
 * curl -X POST http://localhost:3000/api/portraits/extract \
 *   -H "Content-Type: application/json" \
 *   -H "x-service-role-key: <SUPABASE_SERVICE_ROLE_KEY>" \
 *   -d '{
 *     "briefingId": "00000000-0000-0000-0000-000000000001"
 *   }'
 *
 * Expected 200 (enqueued):
 * {
 *   "ok": true,
 *   "queueId": "<uuid>",
 *   "status": "queued"
 * }
 *
 * Expected 200 (already extracted, no force):
 * { "skipped": "already_extracted" }
 *
 * Expected 200 (user opted out):
 * { "skipped": "opt_out" }
 *
 * Expected 400: { "error": "briefingId is required" }
 * Expected 401: { "error": "Unauthorized" }
 * Expected 404: { "error": "Briefing not found" }
 * Expected 409: { "error": "Briefing already in queue" }
 * Expected 500: { "error": "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin, createServerSupabaseClient } from '@/lib/supabase/server';
import { BUSINESS } from '../../../../../config/business.config';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const ADMIN_EMAILS = BUSINESS.adminEmails;

/**
 * Returns true when the request carries a valid service-role key.
 * This allows non-browser callers (cron jobs, webhooks, other API routes)
 * to trigger extraction without an interactive session.
 */
function isServiceRoleRequest(req: NextRequest): boolean {
  const key = req.headers.get('x-service-role-key');
  return Boolean(key && key === process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Returns true when the caller has an active admin session.
 */
async function isAdminSession(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return false;
    const email = session.user.email?.toLowerCase() ?? '';
    return ADMIN_EMAILS.includes(email);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const ExtractRequestSchema = z.object({
  briefingId: z.string().uuid({ message: 'briefingId must be a valid UUID' }),
  force: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ------------------------------------------------------------------
  // Auth: require admin session OR service-role key
  // ------------------------------------------------------------------
  const serviceRole = isServiceRoleRequest(req);
  const adminSession = serviceRole ? false : await isAdminSession();

  if (!serviceRole && !adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ------------------------------------------------------------------
  // Parse + validate body
  // ------------------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = ExtractRequestSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? 'briefingId is required' },
      { status: 400 },
    );
  }

  const { briefingId, force } = parseResult.data;

  // ------------------------------------------------------------------
  // 1. Load briefing — 404 if missing
  // ------------------------------------------------------------------
  const { data: briefing, error: briefingError } = await supabaseAdmin
    .from('briefings')
    .select('id, user_id, extraction_status')
    .eq('id', briefingId)
    .maybeSingle();

  if (briefingError) {
    console.error('[portraits/extract] Briefing lookup error:', briefingError);
    return NextResponse.json({ error: 'Failed to load briefing' }, { status: 500 });
  }

  if (!briefing) {
    return NextResponse.json({ error: 'Briefing not found' }, { status: 404 });
  }

  // ------------------------------------------------------------------
  // 2. Short-circuit if already extracted and force is not set
  // ------------------------------------------------------------------
  if (briefing.extraction_status === 'completed' && !force) {
    return NextResponse.json({ skipped: 'already_extracted' });
  }

  // ------------------------------------------------------------------
  // 3. Check user opt-out
  // ------------------------------------------------------------------
  const { data: userRow, error: userError } = await supabaseAdmin
    .from('users')
    .select('portrait_opt_out')
    .eq('id', briefing.user_id)
    .maybeSingle();

  if (userError) {
    console.error('[portraits/extract] User opt-out lookup error:', userError);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }

  if (userRow?.portrait_opt_out === true) {
    // Mark briefing as skipped and return early.
    await supabaseAdmin
      .from('briefings')
      .update({ extraction_status: 'skipped' })
      .eq('id', briefingId);

    return NextResponse.json({ skipped: 'opt_out' });
  }

  // ------------------------------------------------------------------
  // 4. Enqueue — ON CONFLICT DO NOTHING (partial unique index on
  //    briefing_id WHERE status IN ('pending','processing') prevents
  //    double-enqueuing an in-flight item)
  // ------------------------------------------------------------------
  const { data: inserted, error: queueError } = await supabaseAdmin
    .from('portrait_update_queue')
    .insert({
      user_id: briefing.user_id,
      briefing_id: briefingId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (queueError) {
    // Unique constraint violation = briefing already in queue.
    if (queueError.code === '23505') {
      // Fetch the existing queue row so we can still run the worker if needed.
      const { data: existing } = await supabaseAdmin
        .from('portrait_update_queue')
        .select('id, status')
        .eq('briefing_id', briefingId)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'Briefing already in queue', queueId: existing.id, status: existing.status },
          { status: 409 },
        );
      }

      // No active row found (completed/failed) — fall through and re-insert
      // isn't possible here without the partial unique; surface as a conflict.
      return NextResponse.json({ error: 'Briefing already in queue' }, { status: 409 });
    }

    console.error('[portraits/extract] Queue insert error:', queueError);
    return NextResponse.json({ error: 'Failed to enqueue extraction' }, { status: 500 });
  }

  const queueId = inserted.id as string;

  // ------------------------------------------------------------------
  // 5. Return immediately — the cron at /api/cron/portrait-extraction-queue
  //    will pick up this row within 5 minutes and call processPortraitUpdate.
  //    The synchronous worker call was removed; this endpoint now returns
  //    in <200 ms regardless of OpenAI latency.
  // ------------------------------------------------------------------
  return NextResponse.json({
    ok: true,
    queueId,
    status: 'queued',
  });
}

export const dynamic = 'force-dynamic';
