/**
 * POST /api/portrait/me/reset
 *
 * User-initiated reset of a single portrait section. Promotes the current
 * fact to prior[] (if non-null), nulls out current, and writes a
 * 'reset' entry to portrait_audit_log.
 *
 * Body: { section: 'identity' | 'values' | 'energy' | 'activity' | 'results' | 'path' }
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';
import {
  SECTION_NAMES,
  type PortraitSection,
  type SectionNameType,
  type StoredSections,
} from '@/lib/portraits/schema';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const section = body.section as SectionNameType | undefined;

    if (!section || !SECTION_NAMES.includes(section)) {
      return NextResponse.json(
        { error: `section must be one of: ${SECTION_NAMES.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: portrait, error: loadErr } = await supabaseAdmin
      .from('user_portraits')
      .select('sections')
      .eq('user_id', user.id)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }

    const sections = (portrait?.sections ?? {}) as StoredSections;
    const existing: PortraitSection = (sections[section] ?? {
      current: null,
      prior: [],
      transitions: [],
    }) as PortraitSection;

    const previousCurrent = existing.current;

    const updatedSection: PortraitSection = {
      current: null,
      prior: previousCurrent ? [previousCurrent, ...existing.prior] : existing.prior,
      transitions: existing.transitions,
    };

    const nextSections: StoredSections = { ...sections, [section]: updatedSection };

    if (!portrait) {
      // First-time interaction: create the row so the reset is recorded
      const { error: insertErr } = await supabaseAdmin
        .from('user_portraits')
        .insert({ user_id: user.id, sections: nextSections });
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    } else {
      const { error: updateErr } = await supabaseAdmin
        .from('user_portraits')
        .update({ sections: nextSections })
        .eq('user_id', user.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    const { error: auditErr } = await supabaseAdmin.from('portrait_audit_log').insert({
      user_id: user.id,
      briefing_id: null,
      direction: 'reset',
      section,
      field_path: 'current',
      old_value: previousCurrent ?? null,
      new_value: null,
      actor_id: user.id,
    });
    if (auditErr) {
      // Audit failure shouldn't roll back the reset — log and continue
      console.error('portrait_audit_log insert failed:', auditErr.message);
    }

    return NextResponse.json({ success: true, section, updatedSection });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
