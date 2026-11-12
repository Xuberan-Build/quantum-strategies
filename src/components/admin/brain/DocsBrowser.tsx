'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DOC_SORTS, type DocSort } from '@/lib/brain/doc-topics';
import styles from './brain.module.css';
import archive from './archive.module.css';
import browser from './docs-browser.module.css';

export interface DocRow {
  slug: string;
  path: string;
  title: string;
  hash: string;
  updatedAt: string;
  updatedLabel: string;
  versions: number;
  open: number;
  total: number;
  topicId: string;
  topicLabel: string;
  run: string | null;
}

interface DocsBrowserProps {
  rows: DocRow[];
  initialTopic?: string;
  initialSort?: DocSort;
  initialQuery?: string;
}

const ALL = 'all';

function folderOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '(root)';
}

export function DocsBrowser({ rows, initialTopic = ALL, initialSort = 'newest', initialQuery = '' }: DocsBrowserProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [sort, setSort] = useState<DocSort>(initialSort);
  const [query, setQuery] = useState(initialQuery);

  // Keep the view in the URL so it survives a refresh and can be shared.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const set = (k: string, v: string, def: string) => (v && v !== def ? params.set(k, v) : params.delete(k));
    set('topic', topic, ALL);
    set('sort', sort, 'newest');
    set('q', query.trim(), '');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [topic, sort, query]);

  const topics = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const r of rows) {
      const t = m.get(r.topicId) ?? { label: r.topicLabel, count: 0 };
      t.count++;
      m.set(r.topicId, t);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label));
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter(
      (r) => (topic === ALL || r.topicId === topic) && (!q || r.title.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)),
    );
    const byDate = (a: DocRow, b: DocRow) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    switch (sort) {
      case 'oldest':
        return filtered.sort((a, b) => -byDate(a, b));
      case 'title':
        return filtered.sort((a, b) => a.title.localeCompare(b.title));
      case 'folder':
        return filtered.sort((a, b) => a.path.localeCompare(b.path));
      default:
        return filtered.sort(byDate);
    }
  }, [rows, topic, sort, query]);

  const groups = useMemo(() => {
    if (sort !== 'folder') return [{ key: null as string | null, items: visible }];
    const m = new Map<string, DocRow[]>();
    for (const r of visible) m.set(folderOf(r.path), [...(m.get(folderOf(r.path)) ?? []), r]);
    return [...m.entries()].map(([key, items]) => ({ key, items }));
  }, [visible, sort]);

  return (
    <>
      <div className={browser.toolbar} role="search">
        <div className={browser.chips} role="group" aria-label="Filter by topic">
          <button type="button" className={browser.chip} aria-pressed={topic === ALL} onClick={() => setTopic(ALL)}>
            All <span className={browser.count}>{rows.length}</span>
          </button>
          {topics.map(([id, t]) => (
            <button key={id} type="button" className={browser.chip} aria-pressed={topic === id} onClick={() => setTopic(id)}>
              {t.label} <span className={browser.count}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className={browser.controls}>
          <label className={browser.field}>
            <span className={browser.fieldLabel}>Search</span>
            <input
              type="search"
              className={browser.input}
              placeholder="Title or path"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className={browser.field}>
            <span className={browser.fieldLabel}>Sort</span>
            <select className={browser.input} value={sort} onChange={(e) => setSort(e.target.value as DocSort)}>
              {DOC_SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className={browser.summary} aria-live="polite">
        {visible.length} of {rows.length} docs
      </p>

      {groups.map((g) => (
        <section key={g.key ?? 'all'} className={styles.section} aria-label={g.key ?? 'Docs'}>
          {g.key && (
            <div className={styles.sectionHead}>
              <h2 className={archive.docFolder}>brain/{g.key}</h2>
            </div>
          )}
          <ul className={archive.list}>
            {g.items.map((d) => (
              <li key={d.slug} className={archive.item}>
                <div className={archive.itemMain}>
                  <div className={archive.itemMeta}>
                    <span className={browser.topicTag}>{d.topicLabel}</span>
                    {d.run && <span>{d.run}</span>}
                    <span>Updated {d.updatedLabel}</span>
                    <span>
                      {d.versions} version{d.versions === 1 ? '' : 's'}
                    </span>
                    {d.total > 0 && (
                      <span className={d.open ? archive.commentCount : undefined}>
                        {d.open} open · {d.total} note{d.total === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <h3 className={archive.title}>
                    <Link href={`/admin/brain/docs/${encodeURIComponent(d.slug)}`}>{d.title}</Link>
                  </h3>
                  <div className={archive.itemFoot}>
                    <span className={archive.source}>brain/{d.path}</span>
                    <span className={archive.source}>#{d.hash.slice(0, 8)}</span>
                  </div>
                </div>
                <div className={archive.actions}>
                  <Link href={`/admin/brain/docs/${encodeURIComponent(d.slug)}`} className={`${styles.button} ${archive.smallButton}`}>
                    Read
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {visible.length === 0 && rows.length > 0 && (
        <p className={`${styles.small} ${styles.muted}`}>No docs match. Clear the search or pick another topic.</p>
      )}
    </>
  );
}
