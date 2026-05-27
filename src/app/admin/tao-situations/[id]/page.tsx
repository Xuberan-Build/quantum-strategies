import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import TaoSituationForm, { type TaoSituationFormRow } from '@/components/admin/TaoSituationForm';

export default async function TaoSituationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: situation, error } = await supabaseAdmin
    .from('tao_situations')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !situation) {
    notFound();
  }

  const typed = situation as TaoSituationFormRow;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/tao-situations" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle} style={{ fontFamily: 'monospace', fontSize: '1.25rem' }}>
            {typed.id}
          </h1>
          <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--admin-text-muted)' }}>
            {typed.name}
          </span>
        </div>
        <p className={styles.pageDescription}>
          {typed.domain_name} ({typed.domain_id}) · tier {typed.tier}
          {typed.fate ? ` · ${typed.fate}` : ''}
          {typed.core_state ? ` · ${typed.core_state}` : ''}
          {!typed.active && ' · inactive'}
        </p>
      </header>

      <TaoSituationForm initial={typed} />
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
