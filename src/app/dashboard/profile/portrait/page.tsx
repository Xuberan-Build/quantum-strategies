import { redirect } from 'next/navigation';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';
import PortraitView from '@/components/portrait/PortraitView';
import type { StoredSections } from '@/lib/portraits/schema';
import styles from '../../dashboard.module.css';

export const dynamic = 'force-dynamic';

export type AuditEntry = {
  id: string;
  briefing_id: string | null;
  direction: 'read' | 'write' | 'reset' | 'override';
  section: 'identity' | 'values' | 'energy' | 'activity' | 'results' | 'path';
  field_path: string | null;
  created_at: string;
  product_slug: string | null;
};

export type PortraitRow = {
  user_id: string;
  sections: StoredSections;
  opt_out: boolean;
  schema_version: number;
  last_extracted_at: string | null;
  last_reviewed_at: string | null;
  products_completed: string[];
  created_at: string;
  updated_at: string;
};

export default async function PortraitPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  // Use supabaseAdmin for the reads so server-rendered output matches the
  // shape returned by the API route (and is unaffected by RLS edge cases).
  const [portraitResult, auditResult, userResult] = await Promise.all([
    supabaseAdmin
      .from('user_portraits')
      .select('user_id, sections, opt_out, schema_version, last_extracted_at, last_reviewed_at, products_completed, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('portrait_audit_log')
      .select('id, briefing_id, direction, section, field_path, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('users')
      .select('portrait_opt_out')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const portrait = (portraitResult.data ?? null) as PortraitRow | null;
  const auditRows = auditResult.data ?? [];
  const optOut = userResult.data?.portrait_opt_out ?? false;

  // Resolve briefing_id -> product_slug for plain-language audit rendering
  const briefingIds = Array.from(
    new Set(auditRows.map((a) => a.briefing_id).filter((id): id is string => !!id))
  );
  let briefingMap: Record<string, string> = {};
  if (briefingIds.length > 0) {
    const { data: briefings } = await supabaseAdmin
      .from('briefings')
      .select('id, product_slug')
      .in('id', briefingIds);
    briefingMap = Object.fromEntries((briefings ?? []).map((b) => [b.id, b.product_slug]));
  }

  const audit: AuditEntry[] = auditRows.map((a) => ({
    id: a.id,
    briefing_id: a.briefing_id,
    direction: a.direction,
    section: a.section,
    field_path: a.field_path,
    created_at: a.created_at,
    product_slug: a.briefing_id ? briefingMap[a.briefing_id] ?? null : null,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Your Portrait</h1>
        <p className={styles.subtitle}>
          A working picture of who you are right now — shaped by what you&apos;ve told us, kept under your control.
        </p>
      </div>

      <div className={styles.main}>
        <PortraitView
          portrait={portrait}
          audit={audit}
          initialOptOut={optOut}
        />
      </div>
    </div>
  );
}
