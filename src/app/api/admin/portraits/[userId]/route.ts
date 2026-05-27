import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';
import {
  PortraitFactSchema,
  SECTION_NAMES,
  SectionName,
  type PortraitFact,
  type PortraitSection,
  type SectionNameType,
} from '@/lib/portraits/schema';

interface StoredPortrait {
  user_id: string;
  sections: Record<string, PortraitSection | undefined> | null;
  opt_out: boolean;
  schema_version: number;
  last_extracted_at: string | null;
  last_reviewed_at: string | null;
  products_completed: string[] | null;
  created_at: string;
  updated_at: string;
}

const PatchSchema = z
  .object({
    section: SectionName,
    // current may be a PortraitFact (override) or null (clear current only, keep prior).
    current: PortraitFactSchema.nullable().optional(),
    // Optional: push the previous current onto prior[] before replacing.
    appendToPrior: PortraitFactSchema.optional(),
    // Hard-wipe: clears both current AND prior for the section.
    clear: z.boolean().optional(),
  })
  .refine(
    (v) => v.clear === true || v.current !== undefined || v.appendToPrior !== undefined,
    {
      message: 'Provide at least one of: current, appendToPrior, or clear=true.',
    }
  );

function emptySection(): PortraitSection {
  return { current: null, prior: [], transitions: [] };
}

/**
 * GET /api/admin/portraits/[userId]
 *
 * Returns the full portrait, plus the user and all audit entries.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { userId } = await params;

  const [{ data: user }, { data: portrait }, { data: auditEntries }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, email, created_at, portrait_opt_out')
      .eq('id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('user_portraits')
      .select(
        'user_id, sections, opt_out, schema_version, last_extracted_at, last_reviewed_at, products_completed, created_at, updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('portrait_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    user,
    portrait: portrait ?? null,
    auditLog: auditEntries ?? [],
  });
}

/**
 * PATCH /api/admin/portraits/[userId]
 *
 * Body:
 *   {
 *     section: SectionName,                 -- required
 *     current?: PortraitFact | null,        -- override current
 *     appendToPrior?: PortraitFact,         -- optional: push to prior[]
 *     clear?: true                          -- hard-wipe section (both current and prior)
 *   }
 *
 * Behaviour:
 *   1. validateAdminApiRequest()
 *   2. Load portrait (insert empty row if missing so override has somewhere to land)
 *   3. Apply the change
 *   4. Write portrait_audit_log entry: direction='override', actor_id=admin.id
 *   5. Also call logAdminAction() for the central admin audit log (matches
 *      question-pool/friction-log routes; errors are caught + ignored).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { userId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Verify the target user exists (cascade key for both user_portraits and audit log).
  const { data: targetUser } = await supabaseAdmin
    .from('users')
    .select('id, email, portrait_opt_out')
    .eq('id', userId)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Load (or create) the portrait row.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('user_portraits')
    .select(
      'user_id, sections, opt_out, schema_version, last_extracted_at, last_reviewed_at, products_completed, created_at, updated_at'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    console.error('[Admin API] user_portraits load error:', existingError);
    return NextResponse.json({ error: 'Failed to load portrait' }, { status: 500 });
  }

  let portrait: StoredPortrait;
  if (existing) {
    portrait = existing as StoredPortrait;
  } else {
    const seed = {
      user_id: userId,
      sections: {},
      opt_out: !!targetUser.portrait_opt_out,
    };
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('user_portraits')
      .insert(seed)
      .select(
        'user_id, sections, opt_out, schema_version, last_extracted_at, last_reviewed_at, products_completed, created_at, updated_at'
      )
      .single();
    if (insertError || !inserted) {
      console.error('[Admin API] user_portraits seed insert error:', insertError);
      return NextResponse.json({ error: 'Failed to seed portrait' }, { status: 500 });
    }
    portrait = inserted as StoredPortrait;
  }

  const sectionName: SectionNameType = parsed.data.section;
  if (!SECTION_NAMES.includes(sectionName)) {
    return NextResponse.json({ error: 'Invalid section name' }, { status: 400 });
  }

  const allSections = { ...(portrait.sections ?? {}) } as Record<
    string,
    PortraitSection | undefined
  >;
  const oldSection: PortraitSection = allSections[sectionName] ?? emptySection();

  // Clone defensively to avoid mutating the in-memory row before we decide what to log.
  const nextSection: PortraitSection = {
    current: oldSection.current,
    prior: [...oldSection.prior],
    transitions: [...oldSection.transitions],
  };

  let direction: 'override' | 'reset' = 'override';
  let fieldPath: string | null = null;
  let oldValue: unknown = oldSection;
  let newValue: unknown;

  if (parsed.data.clear === true) {
    // Hard wipe — both current AND prior are dropped. Transitions are preserved
    // because they remain an historical record of what the system saw.
    direction = 'reset';
    fieldPath = 'current+prior';
    nextSection.current = null;
    nextSection.prior = [];
    newValue = { current: null, prior: [] };
  } else {
    // Optional: push to prior[] before overriding current.
    if (parsed.data.appendToPrior) {
      nextSection.prior = [...nextSection.prior, parsed.data.appendToPrior as PortraitFact];
    }

    // Override current (or clear current alone when explicitly null).
    if (parsed.data.current !== undefined) {
      fieldPath = 'current';
      oldValue = oldSection.current;
      nextSection.current = parsed.data.current;
      newValue = parsed.data.current;
    } else if (parsed.data.appendToPrior) {
      fieldPath = 'prior';
      oldValue = oldSection.prior;
      newValue = nextSection.prior;
    }
  }

  allSections[sectionName] = nextSection;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('user_portraits')
    .update({ sections: allSections })
    .eq('user_id', userId)
    .select(
      'user_id, sections, opt_out, schema_version, last_extracted_at, last_reviewed_at, products_completed, created_at, updated_at'
    )
    .single();

  if (updateError) {
    console.error('[Admin API] user_portraits update error:', updateError);
    return NextResponse.json({ error: 'Failed to update portrait' }, { status: 500 });
  }

  // Write the canonical portrait audit entry. Failures here are non-fatal but
  // surfaced in logs so an admin override is always observable.
  const { error: auditError } = await supabaseAdmin.from('portrait_audit_log').insert({
    user_id: userId,
    direction,
    section: sectionName,
    field_path: fieldPath,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    actor_id: admin.id,
  });
  if (auditError) {
    console.error('[Admin API] portrait_audit_log insert error:', auditError);
  }

  // Mirror to the central admin audit log (matches the question-pool / friction
  // log pattern). The admin_audit_logs.action_type CHECK constraint may reject
  // new action types; logAdminAction swallows errors, so this is best-effort.
  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'portrait_override',
    targetType: 'user_portrait',
    targetId: userId,
    targetName: targetUser.email,
    previousValue: { section: sectionName, old: oldValue ?? null } as Record<string, unknown>,
    newValue: { section: sectionName, direction, new: newValue ?? null } as Record<string, unknown>,
  });

  return NextResponse.json({ success: true, portrait: updated });
}
