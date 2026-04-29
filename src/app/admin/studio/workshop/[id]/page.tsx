import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../../admin-layout.module.css';
import WorkshopModuleActions from '@/components/admin/studio/workshop/WorkshopModuleActions';

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: workshop, error } = await supabaseAdmin
    .from('workshops')
    .select('*, workshop_modules(id, title, position, video_url, description, workshop_slides(count))')
    .eq('id', id)
    .order('position', { referencedTable: 'workshop_modules' })
    .single();

  if (error || !workshop) notFound();

  const modules = (workshop.workshop_modules ?? []) as any[];
  const totalSlides = modules.reduce((sum: number, m: any) => {
    const count = Array.isArray(m.workshop_slides) ? m.workshop_slides[0]?.count ?? 0 : 0;
    return sum + count;
  }, 0);

  const statusBadge: Record<string, string> = {
    draft: styles.badgeNeutral,
    published: styles.badgeSuccess,
    archived: styles.badgeDanger,
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
          <Link href="/admin/studio/workshop" style={{ color: 'var(--admin-text-muted)', display: 'flex' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className={styles.pageTitle}>{workshop.title}</h1>
          <span className={`${styles.badge} ${statusBadge[workshop.status] ?? styles.badgeNeutral}`}>
            {workshop.status}
          </span>
        </div>
        {workshop.description && (
          <p className={styles.pageDescription}>{workshop.description}</p>
        )}
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Modules</div>
          <div className={styles.statValue}>{modules.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Slides</div>
          <div className={styles.statValue}>{totalSlides}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Slug</div>
          <div style={{ fontSize: '0.875rem', fontFamily: 'monospace', marginTop: '0.25rem' }}>{workshop.slug}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

        {/* Modules list */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Modules</h2>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>{modules.length}</span>
          </div>

          {modules.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyDescription}>No modules yet. Add one using the form.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {modules.map((mod: any, idx: number) => {
                const slideCount = Array.isArray(mod.workshop_slides) ? mod.workshop_slides[0]?.count ?? 0 : 0;
                return (
                  <div
                    key={mod.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '0.875rem 1rem',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--admin-primary)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{mod.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
                        {slideCount} slide{slideCount !== 1 ? 's' : ''}
                        {mod.video_url && ' · Vimeo attached'}
                      </div>
                    </div>
                    <Link
                      href={`/admin/studio/workshop/${id}/module/${mod.id}`}
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                    >
                      Edit Slides
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <WorkshopModuleActions workshopId={id} workshopStatus={workshop.status} />
        </div>
      </div>
    </div>
  );
}
