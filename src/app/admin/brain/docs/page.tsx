import { Banner } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import { DocsBrowser, type DocRow } from '@/components/admin/brain/DocsBrowser';
import { DOC_SORTS, docRun, docTopic, type DocSort } from '@/lib/brain/doc-topics';
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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BrainDocsPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ docs, error }, counts, params] = await Promise.all([listBrainDocs(), commentCounts(), searchParams]);

  const rows: DocRow[] = docs.map((d) => {
    const c = counts.get(d.slug);
    const t = docTopic(d.path);
    return {
      slug: d.slug,
      path: d.path,
      title: d.title,
      hash: d.hash,
      updatedAt: d.updatedAt,
      updatedLabel: formatDate(d.updatedAt),
      versions: d.versions.length,
      open: c?.open ?? 0,
      total: c?.total ?? 0,
      topicId: t.id,
      topicLabel: t.label,
      run: docRun(d.path),
    };
  });
  const sortParam = one(params.sort);
  const initialSort: DocSort = DOC_SORTS.some((s) => s.id === sortParam) ? (sortParam as DocSort) : 'newest';

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
      {rows.length > 0 && (
        <DocsBrowser rows={rows} initialTopic={one(params.topic) ?? 'all'} initialSort={initialSort} initialQuery={one(params.q) ?? ''} />
      )}
      {!error && docs.length === 0 && <p className={`${styles.small} ${styles.muted}`}>No docs published yet.</p>}
    </div>
  );
}
