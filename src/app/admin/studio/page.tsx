import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';

interface StudioDef {
  format: string;
  label: string;
  description: string;
  color: string;
  href: string;
  newHref: string | null;
  placeholder?: boolean;
  external?: boolean;
}

const STUDIOS: StudioDef[] = [
  {
    format: 'workshop',
    label: 'Course Studio',
    description: 'Slide-based courses with Vimeo video per module. Build modules, author slides, publish to the portal.',
    color: '#10b981',
    href: '/admin/studio/workshop',
    newHref: null,
  },
  {
    format: 'ebook',
    label: 'Ebook Studio',
    description: 'Long-form guides and books grounded in the corpus. Full Brief → Research → Outline → Draft → Distribute pipeline.',
    color: '#8b5cf6',
    href: '/admin/studio/ebook',
    newHref: '/admin/studio/new?format=ebook',
  },
  {
    format: 'whitepaper',
    label: 'Whitepaper Studio',
    description: 'Research-backed whitepapers and field guides. Academic tone, corpus-cited, gated content.',
    color: '#f59e0b',
    href: '/admin/studio/whitepaper',
    newHref: '/admin/studio/new?format=whitepaper',
  },
  {
    format: 'article',
    label: 'Article Studio',
    description: 'Blog posts, editorial content, and thought leadership pieces managed in the content CMS.',
    color: '#3b82f6',
    href: '/admin/content',
    newHref: '/admin/content/new',
    external: true,
  },
  {
    format: 'blog-calendar',
    label: 'Blog Calendar',
    description: 'Editorial calendar for scheduling and planning blog content across strategic pillars.',
    color: '#6b7280',
    href: '/admin/studio/blog-calendar',
    newHref: null,
    placeholder: true,
  },
  {
    format: 'social-calendar',
    label: 'Social Calendar',
    description: 'Social content planning across Twitter, LinkedIn, and Instagram — scheduled from distributed pieces.',
    color: '#6b7280',
    href: '/admin/studio/social-calendar',
    newHref: null,
    placeholder: true,
  },
];

const STUDIO_FORMATS = ['ebook', 'whitepaper'] as const;

export default async function StudioHubPage() {
  const [anglesResult, articlesResult, workshopsResult] = await Promise.all([
    supabaseAdmin.from('content_angles').select('format, status'),
    supabaseAdmin.from('content_posts').select('id, is_published'),
    supabaseAdmin.from('workshops').select('id, status'),
  ]);

  const angles = anglesResult.data ?? [];
  const articles = articlesResult.data ?? [];
  const workshops = workshopsResult.data ?? [];

  const counts: Record<string, { total: number; published: number }> = {};
  for (const fmt of STUDIO_FORMATS) {
    const rows = angles.filter((a) => a.format === fmt);
    counts[fmt] = { total: rows.length, published: rows.filter((a) => a.status === 'published').length };
  }
  counts['article'] = {
    total: articles.length,
    published: articles.filter((a) => a.is_published).length,
  };
  counts['workshop'] = {
    total: workshops.length,
    published: workshops.filter((w) => w.status === 'published').length,
  };

  const totalAngles = angles.length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Content Studio</h1>
          <p className={styles.pageDescription}>
            Content production hub — from strategy suggestion to published asset.
          </p>
        </div>
      </header>

      {/* Quick stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Pieces</div>
          <div className={styles.statValue}>{totalAngles + (articles?.length ?? 0)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Ebooks</div>
          <div className={styles.statValue}>{counts.ebook?.total ?? 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Whitepapers</div>
          <div className={styles.statValue}>{counts.whitepaper?.total ?? 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Courses</div>
          <div className={styles.statValue}>{counts.workshop?.total ?? 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Articles</div>
          <div className={styles.statValue}>{counts.article?.total ?? 0}</div>
        </div>
      </div>

      {/* Studio cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {STUDIOS.map((studio) => {
          const count = counts[studio.format as keyof typeof counts];
          return (
            <div
              key={studio.format}
              className={styles.card}
              style={{
                display: 'flex', flexDirection: 'column', gap: '1rem',
                opacity: studio.placeholder ? 0.7 : 1,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{
                    display: 'inline-block', width: 10, height: 10,
                    borderRadius: '50%', backgroundColor: studio.color,
                    marginRight: '0.5rem', verticalAlign: 'middle',
                  }} />
                  <span style={{ fontWeight: 600, fontSize: '1rem' }}>{studio.label}</span>
                </div>
                {studio.placeholder && (
                  <span className={`${styles.badge} ${styles.badgeNeutral}`}>Coming Soon</span>
                )}
                {!studio.placeholder && count && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                    {count.total} total · {count.published} published
                  </span>
                )}
              </div>

              {/* Description */}
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--admin-text-muted)', lineHeight: 1.6 }}>
                {studio.description}
              </p>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                {studio.placeholder ? (
                  <Link href={studio.href} className={`${styles.btn} ${styles.btnSecondary}`} style={{ flex: 1, justifyContent: 'center' }}>
                    View Placeholder
                  </Link>
                ) : (
                  <>
                    <Link href={studio.href} className={`${styles.btn} ${styles.btnSecondary}`} style={{ flex: 1, justifyContent: 'center' }}>
                      Open Studio
                    </Link>
                    {studio.newHref && (
                      <Link href={studio.newHref} className={`${styles.btn} ${styles.btnPrimary}`}>
                        + New
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
