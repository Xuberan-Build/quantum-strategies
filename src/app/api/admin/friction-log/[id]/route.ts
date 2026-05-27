/**
 * GET  /api/admin/friction-log/[id]  — fetch single friction log row
 * PATCH /api/admin/friction-log/[id] — triage / update status
 *
 * Manual verification:
 *
 * # Fetch single row
 * curl "http://localhost:3000/api/admin/friction-log/00000000-0000-0000-0000-000000000001" \
 *   -H "Cookie: <admin-auth-cookie>"
 *
 * # Triage: mark as resolved with a note
 * curl -X PATCH "http://localhost:3000/api/admin/friction-log/00000000-0000-0000-0000-000000000001" \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: <admin-auth-cookie>" \
 *   -d '{ "status": "resolved", "triage_note": "Reworded step 3 prompt to be clearer." }'
 *
 * # Update triage note only (status unchanged)
 * curl -X PATCH "http://localhost:3000/api/admin/friction-log/00000000-0000-0000-0000-000000000001" \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: <admin-auth-cookie>" \
 *   -d '{ "triage_note": "Added to backlog." }'
 *
 * Expected 200 (GET):  { "row": { ...full row... } }
 * Expected 200 (PATCH): { "row": { ...updated row... } }
 * Expected 400: { "error": "..." }
 * Expected 401: { "error": "Not authenticated" }
 * Expected 404: { "error": "Friction log entry not found" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';
import type { Database } from '@/types/supabase';

type StepFrictionLogUpdate = Database['public']['Tables']['step_friction_log']['Update'];

const VALID_STATUSES = ['new', 'triaged', 'resolved', 'wont_fix'] as const;

const TriageSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  triage_note: z.string().max(2000).optional(),
});

/**
 * GET /api/admin/friction-log/[id]
 * Return a single friction log entry for the admin edit view.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('step_friction_log')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Friction log entry not found' }, { status: 404 });
  }

  return NextResponse.json({ row });
}

/**
 * PATCH /api/admin/friction-log/[id]
 * Update status and/or triage_note. Sets triaged_by/triaged_at whenever
 * status changes to anything other than 'new'.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = TriageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updates = parsed.data;

  // Require at least one field
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'Body must include at least one of: status, triage_note' },
      { status: 400 }
    );
  }

  // Verify the row exists and capture pre-update state for the audit log
  const { data: current, error: fetchError } = await supabaseAdmin
    .from('step_friction_log')
    .select('id, status, triage_note, triaged_by, triaged_at, product_slug, step_index, reason')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Friction log entry not found' }, { status: 404 });
  }

  // Build the update payload
  const patch: StepFrictionLogUpdate = {};

  if (updates.status !== undefined) {
    patch.status = updates.status;
  }
  if (updates.triage_note !== undefined) {
    patch.triage_note = updates.triage_note;
  }

  // Set triaged_by / triaged_at whenever status changes away from 'new'
  const newStatus = updates.status ?? current.status;
  if (newStatus !== 'new') {
    patch.triaged_by = admin.id;
    patch.triaged_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('step_friction_log')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError || !updated) {
    console.error('[step-friction] Admin triage update error:', updateError);
    return NextResponse.json({ error: 'Failed to update friction log entry' }, { status: 500 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'friction_triage',
    targetType: 'friction_log',
    targetId: id,
    targetName: `${current.product_slug} step ${current.step_index} (${current.reason})`,
    previousValue: {
      status: current.status,
      triage_note: current.triage_note,
      triaged_by: current.triaged_by,
      triaged_at: current.triaged_at,
    },
    newValue: {
      status: updated.status,
      triage_note: updated.triage_note,
      triaged_by: updated.triaged_by,
      triaged_at: updated.triaged_at,
    },
  });

  return NextResponse.json({ row: updated });
}
