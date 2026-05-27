import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import FrictionLogTriageForm from '@/components/admin/FrictionLogTriageForm';
import type { FrictionLogListRow } from '@/components/admin/FrictionLogList';

export default async function FrictionLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: row, error } = await supabaseAdmin
    .from('step_friction_log')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !row) {
    notFound();
  }

  const typed = row as FrictionLogListRow;

  // Optional: resolve reporter + triager emails for display (best-effort)
  const userIds = [typed.user_id, typed.triaged_by].filter((u): u is string => Boolean(u));
  let reporterEmail: string | null = null;
  let triagedByEmail: string | null = null;

  if (userIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', userIds);

    const emailById = new Map<string, string>();
    users?.forEach((u: { id: string; email: string | null }) => {
      if (u.email) emailById.set(u.id, u.email);
    });
    if (typed.user_id) reporterEmail = emailById.get(typed.user_id) ?? null;
    if (typed.triaged_by) triagedByEmail = emailById.get(typed.triaged_by) ?? null;
  }

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/friction-log" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1
            className={styles.pageTitle}
            style={{ fontFamily: 'monospace', fontSize: '1.125rem', wordBreak: 'break-all' }}
          >
            {typed.id}
          </h1>
        </div>
        <p className={styles.pageDescription}>
          {typed.product_slug}
          {typed.step_index !== null && ` · step ${typed.step_index}`} · {typed.reason} ·{' '}
          {typed.status}
        </p>
      </header>

      <FrictionLogTriageForm
        row={typed}
        reporterEmail={reporterEmail}
        triagedByEmail={triagedByEmail}
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
