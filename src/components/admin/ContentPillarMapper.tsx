'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

interface Post {
  id: string;
  slug: string;
  type: string;
  title: string;
  is_published: boolean;
  pillar_id: string | null;
}

interface Pillar {
  id: string;
  title: string;
}

const TYPE_BADGE: Record<string, string> = {
  blog: styles.badgeSuccess,
  whitepaper: styles.badgeNeutral,
  resource: styles.badgeWarning,
};

// Title-keyword heuristics for auto-suggest
function suggestPillar(title: string, pillars: Pillar[]): string | null {
  const t = title.toLowerCase();
  const find = (keyword: string) => pillars.find((p) => p.title.toLowerCase().includes(keyword))?.id ?? null;

  if (/waveform|episode \d+|wave shape|amplitude|frequency|resonan|interferen|duty cycle|phase|period|pattern problem|astrology/i.test(t))
    return find('architecture');
  if (/business model|ecosystem|scale.*framework|framework.*scale/i.test(t))
    return find('strategy');
  if (/community|network|discord|kingdom|referral|affiliate|partnership/i.test(t))
    return find('network');
  if (/identity|self|consciousness|ego|perception|human design|nlp|personal brand/i.test(t))
    return find('self');
  if (/acquisition|seo|marketing|conversion|crm|automation|mvp|product.market|user research|operations|gtm|demand|content market/i.test(t))
    return find('builder');

  return null;
}

export default function ContentPillarMapper({ posts: initialPosts, pillars }: { posts: Post[]; pillars: Pillar[] }) {
  const [posts, setPosts]     = useState(initialPosts);
  const [saving, setSaving]   = useState<Set<string>>(new Set());
  const [dirty, setDirty]     = useState<Set<string>>(new Set());
  const [saveAll, setSaveAll] = useState(false);
  const [filter, setFilter]   = useState<'all' | 'unlinked'>('unlinked');

  const unlinked = posts.filter((p) => !p.pillar_id).length;

  function setPillar(postId: string, pillarId: string | null) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, pillar_id: pillarId } : p));
    setDirty((prev) => new Set(prev).add(postId));
  }

  function autoSuggest() {
    const updated = posts.map((p) => {
      const suggested = suggestPillar(p.title, pillars);
      if (suggested && !p.pillar_id) {
        setDirty((prev) => new Set(prev).add(p.id));
        return { ...p, pillar_id: suggested };
      }
      return p;
    });
    setPosts(updated);
  }

  async function savePost(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    setSaving((prev) => new Set(prev).add(postId));
    await fetch('/api/admin/content/bulk-assign', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments: [{ id: postId, pillar_id: post.pillar_id }] }),
    });
    setSaving((prev) => { const s = new Set(prev); s.delete(postId); return s; });
    setDirty((prev) => { const s = new Set(prev); s.delete(postId); return s; });
  }

  async function saveAllDirty() {
    setSaveAll(true);
    const dirtyPosts = posts.filter((p) => dirty.has(p.id));
    await fetch('/api/admin/content/bulk-assign', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments: dirtyPosts.map((p) => ({ id: p.id, pillar_id: p.pillar_id })),
      }),
    });
    setDirty(new Set());
    setSaveAll(false);
  }

  const shown = filter === 'unlinked' ? posts.filter((p) => !p.pillar_id || dirty.has(p.id)) : posts;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>All Posts</h2>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          {unlinked > 0 && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-warning)' }}>
              {unlinked} unlinked
            </span>
          )}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
            onClick={() => setFilter(filter === 'all' ? 'unlinked' : 'all')}
          >
            {filter === 'all' ? 'Show unlinked' : 'Show all'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
            onClick={autoSuggest}
          >
            Auto-suggest
          </button>
          {dirty.size > 0 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
              disabled={saveAll}
              onClick={saveAllDirty}
            >
              {saveAll ? 'Saving…' : `Save ${dirty.size} change${dirty.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>
          {filter === 'unlinked' ? 'All posts are pillar-linked.' : 'No posts yet.'}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Pillar</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((post) => {
              const isDirty = dirty.has(post.id);
              return (
                <tr key={post.id} style={{ opacity: post.is_published ? 1 : 0.6 }}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{post.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>
                      /{post.slug}
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${TYPE_BADGE[post.type] ?? styles.badgeNeutral}`}>
                      {post.type}
                    </span>
                    {!post.is_published && (
                      <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ marginLeft: 4 }}>
                        draft
                      </span>
                    )}
                  </td>
                  <td>
                    <select
                      value={post.pillar_id ?? ''}
                      onChange={(e) => setPillar(post.id, e.target.value || null)}
                      className={styles.formInput}
                      style={{
                        fontSize: '0.8125rem', padding: '0.25rem 0.5rem', minWidth: 180,
                        borderColor: isDirty ? 'var(--admin-primary)' : undefined,
                      }}
                    >
                      <option value="">— Unlinked —</option>
                      {pillars.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      {isDirty && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                          disabled={saving.has(post.id)}
                          onClick={() => savePost(post.id)}
                        >
                          {saving.has(post.id) ? '…' : 'Save'}
                        </button>
                      )}
                      <Link
                        href={`/admin/content/${post.slug}`}
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
