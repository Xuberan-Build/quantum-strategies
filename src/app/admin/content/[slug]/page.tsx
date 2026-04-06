import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ContentPostForm from '@/components/admin/ContentPostForm';
import styles from '../../admin-layout.module.css';

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: post, error } = await supabaseAdmin
    .from('content_posts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !post) {
    notFound();
  }

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/content" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle}>{post.title}</h1>
        </div>
        <p className={styles.pageDescription}>
          {post.type} · /{post.slug}
          {post.is_published && post.published_at && (
            <> · Published {new Date(post.published_at).toLocaleDateString()}</>
          )}
          {!post.is_published && ' · Draft'}
        </p>
      </header>

      <ContentPostForm
        mode="edit"
        initialPost={{
          id: post.id,
          slug: post.slug,
          type: post.type,
          title: post.title,
          excerpt: post.excerpt || '',
          body: post.body || '',
          author: post.author || '',
          tags: post.tags || [],
          is_published: post.is_published,
        }}
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
