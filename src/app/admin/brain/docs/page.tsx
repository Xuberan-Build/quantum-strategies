import Link from 'next/link';
import { Banner } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import archive from '@/components/admin/brain/archive.module.css';
import { BRAIN_FEEDBACK_TABLE } from '@/lib/brain/feedback';
import { listBrainDocs } from '@/lib/brain/load';
import { formatDate } from '@/lib/brain/viz';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Open/total comment counts per doc slug. Never throws (the table may not exist yet). */
async function commentCounts(): Promise<Map<string, { open: number; total: number }>> {
  const counts = new Map<string, { open: number; total: number }>();
  try {
    const { data } = await supabaseAdmin.from(BRAIN_FEEDBACK_TABLE).select('target_id, status').eq('target_type', 'doc').limit(5000);
    for (const row of (data ?? []) as { target_id: string; status: string }[]) {
      const c = counts.get(row.target_id) ?? { open: 0, total: 0 };
      c.total++;
      if (row.status === 'open') c.open++;
      counts.set(row.target_id, c);
    }
  } catch {
    // counts are optional
  }
  return counts;
}

export default async function BrainDocsPage() {
  const [{ docs, error }, counts] = await Promise.all([listBrainDocs(), commentCounts()]);

  const folders = new Map<string, typeof docs>();
  for (const d of docs) {
    const folder = d.path.includes('/') ? d.path.slice(0, d.path.lastIndexOf('/')) : '(root)';
    folders.set(folder, [...(folders.get(folder) ?? []), d]);
  }

  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <div className={styles.eyebrow}>Source of truth</div>
        <h1 className={styles.pageTitle}>Docs</h1>
        <p className={styles.pageLede}>
          Brain reports published for reading and comment. Select a section or highlight text to leave a note; Claude picks notes up from the
          brain inbox, edits the doc and replies here. Every published version is kept, so a note always points at the text it was made on.
        </p>
      </header>
      {error && (
        <Banner label="Docs unavailable">
          {error}. Run <span className={styles.mono}>scripts/brain/publish-docs.ts</span> to publish the docs listed in{' '}
          <span className={styles.mono}>brain/docs.json</span>.
        </Banner>
      )}
      {[...folders.entries()].map(([folder, items]) => (
        <section key={folder} className={styles.section} aria-label={folder}>
          <div className={styles.sectionHead}>
            <h2 className={archive.docFolder}>brain/{folder}</h2>
          </div>
          <ul className={archive.list}>
            {items.map((d) => {
              const c = counts.get(d.slug);
              return (
                <li key={d.slug} className={archive.item}>
                  <div className={archive.itemMain}>
                    <div className={archive.itemMeta}>
                      <span>Updated {formatDate(d.updatedAt)}</span>
                      <span>
                        {d.versions.length} version{d.versions.length === 1 ? '' : 's'}
                      </span>
                      {c && (
                        <span className={c.open ? archive.commentCount : undefined}>
                          {c.open} open · {c.total} note{c.total === 1 ? '' : 's'}
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
              );
            })}
          </ul>
        </section>
      ))}
      {!error && docs.length === 0 && <p className={`${styles.small} ${styles.muted}`}>No docs published yet.</p>}
    </div>
  );
}
