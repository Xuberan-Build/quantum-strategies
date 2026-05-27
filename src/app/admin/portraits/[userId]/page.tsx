import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import PortraitInspector, {
  type AuditLogEntry,
  type BriefingRow,
  type PortraitData,
} from '@/components/admin/PortraitInspector';
import { SECTION_NAMES, type PortraitSection } from '@/lib/portraits/schema';

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  portrait_opt_out: boolean | null;
}

interface PortraitRow {
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

export default async function AdminPortraitDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const [
    { data: user },
    { data: portrait },
    { data: auditEntries, error: auditError },
    { data: briefings, error: briefingsError },
  ] = await Promise.all([
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
      .select('id, user_id, briefing_id, direction, section, field_path, old_value, new_value, actor_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabaseAdmin
      .from('briefings')
      .select('id, product_slug, generated_at, extraction_status, extraction_error, extracted_at')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(200),
  ]);

  if (!user) {
    notFound();
  }

  if (auditError) {
    console.error('[Admin] portrait_audit_log fetch error:', auditError);
  }
  if (briefingsError) {
    console.error('[Admin] briefings fetch error:', briefingsError);
  }

  const typedUser = user as UserRow;
  const typedPortrait = (portrait ?? null) as PortraitRow | null;

  // Normalise sections into a known-keys map (each section may be undefined).
  const sections: PortraitData['sections'] = {};
  for (const name of SECTION_NAMES) {
    sections[name] = typedPortrait?.sections?.[name] ?? null;
  }

  const portraitData: PortraitData = {
    user_id: typedUser.id,
    sections,
    opt_out: !!(typedPortrait?.opt_out ?? typedUser.portrait_opt_out),
    schema_version: typedPortrait?.schema_version ?? null,
    last_extracted_at: typedPortrait?.last_extracted_at ?? null,
    last_reviewed_at: typedPortrait?.last_reviewed_at ?? null,
    products_completed: typedPortrait?.products_completed ?? [],
    created_at: typedPortrait?.created_at ?? null,
    updated_at: typedPortrait?.updated_at ?? null,
  };

  const audit = ((auditEntries ?? []) as AuditLogEntry[]).map((e) => ({ ...e }));

  // Fetch retry counts from portrait_update_queue.attempts (the source of
  // truth — briefings.extraction_attempts was dropped to remove the
  // two-counter redundancy). A briefing may have more than one queue row
  // historically (re-enqueue after failure); take the max attempts seen.
  type BriefingRawRow = Omit<BriefingRow, 'attempts'>;
  const rawBriefings = (briefings ?? []) as BriefingRawRow[];
  const briefingIds = rawBriefings.map((b) => b.id);
  const attemptsByBriefingId: Record<string, number> = {};

  if (briefingIds.length > 0) {
    const { data: queueRows, error: queueError } = await supabaseAdmin
      .from('portrait_update_queue')
      .select('briefing_id, attempts')
      .in('briefing_id', briefingIds);

    if (queueError) {
      console.error('[Admin] portrait_update_queue fetch error:', queueError);
    }

    for (const row of (queueRows ?? []) as Array<{
      briefing_id: string | null;
      attempts: number;
    }>) {
      if (!row.briefing_id) continue;
      const prev = attemptsByBriefingId[row.briefing_id] ?? 0;
      if (row.attempts > prev) attemptsByBriefingId[row.briefing_id] = row.attempts;
    }
  }

  const briefingRows: BriefingRow[] = rawBriefings.map((b) => ({
    ...b,
    attempts: attemptsByBriefingId[b.id] ?? 0,
  }));

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/portraits" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle} style={{ fontSize: '1.25rem' }}>
            {typedUser.email}
          </h1>
        </div>
        <p className={styles.pageDescription}>
          User created {new Date(typedUser.created_at).toISOString().slice(0, 10)} ·{' '}
          {portraitData.opt_out ? 'opted out' : 'opted in'} ·{' '}
          {typedPortrait
            ? `portrait schema v${portraitData.schema_version ?? '?'}`
            : 'no portrait row yet'}
        </p>
      </header>

      <PortraitInspector
        portrait={portraitData}
        userEmail={typedUser.email}
        auditLog={audit}
        briefings={briefingRows}
      />
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
