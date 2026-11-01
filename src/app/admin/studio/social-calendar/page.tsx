import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import styles from '../../admin-layout.module.css';
import { monthGrid, pieceTypeColor, pieceTypeLabel, PIECE_TYPES } from '@/lib/content/calendar';

export const dynamic = 'force-dynamic';

type Piece = {
  id: string;
  title: string | null;
  piece_type: string;
  status: string;
  scheduled_for: string | null;
  source: { slug: string; title: string } | null;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function shift(year: number, month: number, by: number) {
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function ContentCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; type?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const [y, m] = (sp.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-').map(Number);
  const weeks = monthGrid(y, m);
  const from = weeks[0][0];
  const to = weeks[weeks.length - 1][6];

  let q = supabaseAdmin
    .from('content_pieces')
    .select('id, title, piece_type, status, scheduled_for, source:content_posts!content_pieces_source_post_id_fkey(slug, title)')
    .gte('scheduled_for', from)
    .lte('scheduled_for', to)
    .order('scheduled_for');
  if (sp.type) q = q.eq('piece_type', sp.type);
  const { data, error } = await q;
  const pieces = (data ?? []) as unknown as Piece[];

  const byDay = new Map<string, Piece[]>();
  for (const p of pieces) {
    const k = p.scheduled_for as string;
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  const today = now.toISOString().slice(0, 10);
  const monthKey = `${y}-${String(m).padStart(2, '0')}`;
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { month: monthKey, type: sp.type, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Studio Hub
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>Content Calendar</h1>
          <p className={styles.pageDescription}>
            Short-form pieces distilled from the long-form articles. Click a piece to edit it beside its source.
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Link href={qs({ month: shift(y, m, -1) })} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>←</Link>
        <strong style={{ minWidth: '9rem', textAlign: 'center' }}>{MONTHS[m - 1]} {y}</strong>
        <Link href={qs({ month: shift(y, m, 1) })} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>→</Link>
        <span style={{ flex: 1 }} />
        <Link href={qs({ type: undefined })} className={`${styles.btn} ${styles.btnSmall} ${!sp.type ? styles.btnPrimary : styles.btnSecondary}`}>All</Link>
        {Object.entries(PIECE_TYPES)
          .filter(([k]) => !['social_ig', 'social_tiktok', 'blog'].includes(k))
          .map(([k, v]) => (
            <Link key={k} href={qs({ type: k })} className={`${styles.btn} ${styles.btnSmall} ${sp.type === k ? styles.btnPrimary : styles.btnSecondary}`}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: v.color, marginRight: 6 }} />
              {v.label}
            </Link>
          ))}
      </div>

      {error && <div className={styles.formError}>{error.message}</div>}
      <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', margin: '0 0 0.75rem' }}>
        {pieces.length} pieces in this view
      </p>

      <div className={styles.card} style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', minWidth: 910 }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', borderBottom: '1px solid var(--admin-border)' }}>{d}</div>
          ))}
          {weeks.flat().map((day) => {
            const inMonth = Number(day.slice(5, 7)) === m;
            const list = byDay.get(day) ?? [];
            return (
              <div
                key={day}
                style={{
                  minHeight: 120,
                  padding: '0.375rem',
                  borderRight: '1px solid var(--admin-border)',
                  borderBottom: '1px solid var(--admin-border)',
                  opacity: inMonth ? 1 : 0.45,
                  background: day === today ? 'rgba(147, 51, 234, 0.08)' : undefined,
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>{Number(day.slice(8))}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {list.map((p) => (
                    <Link
                      key={p.id}
                      href={`/admin/studio/social-calendar/${p.id}`}
                      title={`${pieceTypeLabel(p.piece_type)} · ${p.source?.title ?? ''}`}
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        lineHeight: 1.3,
                        padding: '3px 6px',
                        borderRadius: 4,
                        borderLeft: `3px solid ${pieceTypeColor(p.piece_type)}`,
                        background: 'var(--admin-bg)',
                        color: 'var(--admin-text)',
                        textDecoration: 'none',
                        textDecorationLine: p.status === 'published' ? 'line-through' : undefined,
                      }}
                    >
                      <span style={{ color: pieceTypeColor(p.piece_type), fontWeight: 600 }}>{pieceTypeLabel(p.piece_type)}</span>
                      {p.status !== 'draft' && <span style={{ marginLeft: 4, color: 'var(--admin-text-muted)' }}>· {p.status}</span>}
                      <br />
                      {p.title ?? '(untitled)'}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
