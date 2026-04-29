import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../../../../admin-layout.module.css';
import SlideEditorClient from '@/components/admin/studio/workshop/SlideEditorClient';

export default async function SlideEditorPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id: workshopId, moduleId } = await params;

  const [workshopResult, moduleResult, slidesResult] = await Promise.all([
    supabaseAdmin.from('workshops').select('id, title').eq('id', workshopId).single(),
    supabaseAdmin.from('workshop_modules').select('*').eq('id', moduleId).single(),
    supabaseAdmin.from('workshop_slides').select('*').eq('module_id', moduleId).order('position'),
  ]);

  if (workshopResult.error || !workshopResult.data) notFound();
  if (moduleResult.error || !moduleResult.data) notFound();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className={styles.pageHeader} style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link href={`/admin/studio/workshop/${workshopId}`} style={{ color: 'var(--admin-text-muted)', display: 'flex' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>{workshopResult.data.title}</span>
          <span style={{ color: 'var(--admin-text-muted)' }}>›</span>
          <h1 className={styles.pageTitle} style={{ margin: 0, fontSize: '1.125rem' }}>
            {moduleResult.data.title}
          </h1>
        </div>
      </header>

      <SlideEditorClient
        workshopId={workshopId}
        module={moduleResult.data}
        initialSlides={slidesResult.data ?? []}
      />
    </div>
  );
}
