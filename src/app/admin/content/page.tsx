import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';

const TYPE_LABELS: Record<string, string> = {
  blog: 'Blog',
  whitepaper: 'Whitepaper',
  resource: 'Resource',
};

const TYPE_BADGE: Record<string, string> = {
  blog: styles.badgeSuccess,
  whitepaper: styles.badgeNeutral,
  resource: styles.badgeWarning,
};

// Auth handled by middleware.ts
export default async function ContentPage() {
  const { data: posts, error } = await supabaseAdmin
    .from('content_posts')
    .select('id, slug, type, title, excerpt, author, is_published, published_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch content posts:', error);
  }

  const allPosts = posts || [];
  const published = allPosts.filter((p) => p.is_published);
  const drafts = allPosts.filter((p) => !p.is_published);
  const blogs = allPosts.filter((p) => p.type === 'blog');
  const whitepapers = allPosts.filter((p) => p.type === 'whitepaper');
  const resources = allPosts.filter((p) => p.type === 'resource');

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className={styles.pageTitle}>Content</h1>
            <p className={styles.pageDescription}>
              Blog posts, whitepapers, and resources
            </p>
          </div>
          <Link href="/admin/content/new" className={`${styles.btn} ${styles.btnPrimary}`}>
            + New Post
          </Link>
        </div>
      </header>

      {/* Stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Posts</div>
          <div className={styles.statValue}>{allPosts.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Published</div>
          <div className={styles.statValue}>{published.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Drafts</div>
          <div className={styles.statValue}>{drafts.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Blog</div>
          <div className={styles.statValue}>{blogs.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Whitepapers</div>
          <div className={styles.statValue}>{whitepapers.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Resources</div>
          <div className={styles.statValue}>{resources.length}</div>
        </div>
      </div>

      {/* Posts Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>All Posts</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link
              href="/admin/content?type=blog"
              className={`${styles.badge} ${styles.badgeSuccess}`}
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
              Blog
            </Link>
            <Link
              href="/admin/content?type=whitepaper"
              className={`${styles.badge} ${styles.badgeNeutral}`}
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
              Whitepaper
            </Link>
            <Link
              href="/admin/content?type=resource"
              className={`${styles.badge} ${styles.badgeWarning}`}
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
              Resource
            </Link>
          </div>
        </div>

        {allPosts.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No posts yet</p>
            <p className={styles.emptyDescription}>
              Create your first blog post, whitepaper, or resource.
            </p>
            <Link href="/admin/content/new" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: '1rem' }}>
              Create First Post
            </Link>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Author</th>
                <th>Status</th>
                <th>Published</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allPosts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{post.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>
                      /{post.slug}
                    </div>
                    {post.excerpt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '2px', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.excerpt}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${TYPE_BADGE[post.type] || styles.badgeNeutral}`}>
                      {TYPE_LABELS[post.type] || post.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>
                    {post.author || '—'}
                  </td>
                  <td>
                    {post.is_published ? (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>Published</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeNeutral}`}>Draft</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                    {new Date(post.updated_at).toLocaleDateString()}
                  </td>
                  <td>
                    <Link
                      href={`/admin/content/${post.slug}`}
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
