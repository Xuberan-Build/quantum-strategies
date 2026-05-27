/**
 * GET  /api/portrait/me — returns the authed user's portrait + recent audit entries.
 * PATCH /api/portrait/me — updates opt_out and / or last_reviewed_at only.
 *
 * Postgres RLS allows authenticated UPDATE on user_portraits but cannot
 * restrict which columns the UPDATE touches. Column-level restriction is
 * enforced HERE: we strip every field except opt_out and last_reviewed_at
 * before passing anything to supabaseAdmin. Never trust the client payload.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type UserPortraitInsert = Database['public']['Tables']['user_portraits']['Insert'];
type UserPortraitUpdate = Database['public']['Tables']['user_portraits']['Update'];

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [{ data: portrait }, { data: audit }, { data: userRow }] = await Promise.all([
      supabaseAdmin
        .from('user_portraits')
        .select('user_id, sections, opt_out, schema_version, last_extracted_at, last_reviewed_at, products_completed, created_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('portrait_audit_log')
        .select('id, briefing_id, direction, section, field_path, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('users')
        .select('portrait_opt_out')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    // Join briefing product_slug for audit log items that reference a briefing
    const briefingIds = Array.from(
      new Set((audit ?? []).map((a) => a.briefing_id).filter((id): id is string => !!id))
    );
    let briefingMap: Record<string, string> = {};
    if (briefingIds.length > 0) {
      const { data: briefings } = await supabaseAdmin
        .from('briefings')
        .select('id, product_slug')
        .in('id', briefingIds);
      briefingMap = Object.fromEntries((briefings ?? []).map((b) => [b.id, b.product_slug]));
    }

    const auditWithSlug = (audit ?? []).map((a) => ({
      ...a,
      product_slug: a.briefing_id ? briefingMap[a.briefing_id] ?? null : null,
    }));

    return NextResponse.json({
      portrait: portrait ?? null,
      audit: auditWithSlug,
      portrait_opt_out: userRow?.portrait_opt_out ?? false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // ---------------------------------------------------------------------
    // Column-level RLS substitute: strip every field except the two columns
    // the client is permitted to set. Postgres RLS allows UPDATE on the row
    // but cannot constrain WHICH columns are written; this is that gate.
    // ---------------------------------------------------------------------
    const updates: Pick<UserPortraitUpdate, 'opt_out' | 'last_reviewed_at'> = {};

    if (typeof body.opt_out === 'boolean') {
      updates.opt_out = body.opt_out;
    }
    if (body.last_reviewed_at === 'now') {
      updates.last_reviewed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Ensure the row exists so first-time confirmers / opt-outers get a record
    const { data: existing } = await supabaseAdmin
      .from('user_portraits')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      const insertRow: UserPortraitInsert = { user_id: user.id, ...updates };
      const { error: insertErr } = await supabaseAdmin
        .from('user_portraits')
        .insert(insertRow);
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    } else {
      const { error: updateErr } = await supabaseAdmin
        .from('user_portraits')
        .update(updates)
        .eq('user_id', user.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    // Mirror opt_out onto users.portrait_opt_out (canonical source)
    if (typeof updates.opt_out === 'boolean') {
      const { error: userErr } = await supabaseAdmin
        .from('users')
        .update({ portrait_opt_out: updates.opt_out })
        .eq('id', user.id);
      if (userErr) {
        return NextResponse.json({ error: userErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, updated: updates });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
