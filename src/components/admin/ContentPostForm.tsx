'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from '@/app/admin/admin-layout.module.css';

const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });

interface ContentPost {
  id?: string;
  slug: string;
  type: 'blog' | 'whitepaper' | 'resource';
  title: string;
  excerpt: string;
  body: string;
  author: string;
  tags: string[];
  is_published: boolean;
}

interface ContentPostFormProps {
  initialPost?: ContentPost;
  mode: 'create' | 'edit';
}

const EMPTY_POST: ContentPost = {
  slug: '',
  type: 'blog',
  title: '',
  excerpt: '',
  body: '',
  author: '',
  tags: [],
  is_published: false,
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200);
}

export default function ContentPostForm({ initialPost, mode }: ContentPostFormProps) {
  const router = useRouter();
  const [post, setPost] = useState<ContentPost>(initialPost || EMPTY_POST);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(mode === 'edit');

  const set = (field: keyof ContentPost, value: unknown) =>
    setPost((prev) => ({ ...prev, [field]: value }));

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    set('title', title);
    if (!slugManuallyEdited) {
      set('slug', slugify(title));
    }
  };

  const handleBodyChange = useCallback((html: string) => {
    set('body', html);
  }, []);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!post.tags.includes(tag)) {
        set('tags', [...post.tags, tag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    set('tags', post.tags.filter((t) => t !== tag));
  };

  const handleSave = async (publishOverride?: boolean) => {
    setSaving(true);
    setStatus({ type: 'idle', message: '' });

    const payload = {
      ...post,
      is_published: publishOverride !== undefined ? publishOverride : post.is_published,
    };

    try {
      let res: Response;

      if (mode === 'create') {
        res = await fetch('/api/admin/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/admin/content/${post.slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to save');
      }

      if (publishOverride !== undefined) {
        set('is_published', publishOverride);
      }

      setStatus({ type: 'success', message: mode === 'create' ? 'Post created' : 'Saved' });

      if (mode === 'create' && result.post?.slug) {
        router.push(`/admin/content/${result.post.slug}`);
      }
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/content/${post.slug}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/admin/content');
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' });
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

      {/* Main editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Title */}
        <div className={styles.card}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Title</label>
            <input
              type="text"
              className={styles.formInput}
              value={post.title}
              onChange={handleTitleChange}
              placeholder="Post title"
              style={{ fontSize: '1.125rem', fontWeight: 500 }}
            />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Slug</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>/</span>
              <input
                type="text"
                className={styles.formInput}
                value={post.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  set('slug', e.target.value.replace(/[^a-z0-9-]/g, ''));
                }}
                placeholder="post-slug"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <p className={styles.formHint}>Lowercase letters, numbers, and hyphens only</p>
          </div>
        </div>

        {/* Excerpt */}
        <div className={styles.card}>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Excerpt</label>
            <textarea
              className={styles.formInput}
              value={post.excerpt}
              onChange={(e) => set('excerpt', e.target.value)}
              rows={3}
              placeholder="Short summary shown in listings and meta descriptions"
            />
          </div>
        </div>

        {/* Body */}
        <div className={styles.card}>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Body</label>
            <div style={{ marginTop: '0.5rem' }}>
              <TiptapEditor
                content={post.body}
                onChange={handleBodyChange}
                placeholder="Write your content here..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '2rem' }}>

        {/* Publish Actions */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Publish</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || deleting}
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ width: '100%' }}
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>

            {post.is_published ? (
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving || deleting}
                className={`${styles.btn} ${styles.btnSecondary}`}
                style={{ width: '100%' }}
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || deleting}
                className={`${styles.btn} ${styles.btnSuccess}`}
                style={{ width: '100%' }}
              >
                Publish
              </button>
            )}
          </div>

          {status.type !== 'idle' && (
            <div style={{
              marginTop: '0.75rem',
              fontSize: '0.8125rem',
              color: status.type === 'success' ? 'var(--admin-success)' : 'var(--admin-danger)',
            }}>
              {status.message}
            </div>
          )}

          {post.is_published && (
            <div style={{ marginTop: '0.75rem', padding: '0.625rem', background: '#d1fae5', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#065f46' }}>
              Published
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Details</h3>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Type</label>
            <select
              className={styles.formInput}
              value={post.type}
              onChange={(e) => set('type', e.target.value)}
            >
              <option value="blog">Blog</option>
              <option value="whitepaper">Whitepaper</option>
              <option value="resource">Resource</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Author</label>
            <input
              type="text"
              className={styles.formInput}
              value={post.author}
              onChange={(e) => set('author', e.target.value)}
              placeholder="Author name"
            />
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Tags</label>
            <input
              type="text"
              className={styles.formInput}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type tag and press Enter"
            />
            {post.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`${styles.badge} ${styles.badgeNeutral}`}
                    style={{ cursor: 'pointer', gap: '0.25rem' }}
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag} ×
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        {mode === 'edit' && (
          <div className={styles.card} style={{ borderColor: '#fca5a5' }}>
            <h3 className={styles.cardTitle} style={{ marginBottom: '0.75rem', color: 'var(--admin-danger)' }}>
              Danger Zone
            </h3>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className={`${styles.btn} ${styles.btnDanger}`}
              style={{ width: '100%' }}
            >
              {deleting ? 'Deleting…' : 'Delete Post'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
