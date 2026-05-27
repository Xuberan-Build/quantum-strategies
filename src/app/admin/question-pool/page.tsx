import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';
import QuestionPoolList, { type QuestionPoolListRow } from '@/components/admin/QuestionPoolList';

// Auth handled by middleware.ts + admin layout
export default async function QuestionPoolPage() {
  const [{ data: questions, error }, { data: products }] = await Promise.all([
    supabaseAdmin
      .from('question_pool')
      .select(
        'id, product_slug, step_index, domain, rite, question_role, experience_level, audience_tracks, prompt_text, active'
      )
      .order('product_slug', { ascending: true })
      .order('step_index', { ascending: true })
      .order('question_role', { ascending: true }),
    supabaseAdmin
      .from('product_definitions')
      .select('product_slug')
      .order('product_slug', { ascending: true }),
  ]);

  if (error) {
    console.error('[Admin] question_pool fetch error:', error);
  }

  const rows: QuestionPoolListRow[] = (questions ?? []) as QuestionPoolListRow[];

  // Combine product slugs from product_definitions and any slugs that already exist in question_pool
  const slugSet = new Set<string>();
  products?.forEach((p) => slugSet.add(p.product_slug));
  rows.forEach((r) => slugSet.add(r.product_slug));
  const productSlugs = Array.from(slugSet).sort();

  const total = rows.length;
  const active = rows.filter((r) => r.active).length;
  const inactive = total - active;
  const uniqueProducts = new Set(rows.map((r) => r.product_slug)).size;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className={styles.pageTitle}>Question Pool</h1>
            <p className={styles.pageDescription}>
              Dynamic question infrastructure for the Three Rites. Anchors, follow-ups, and audience variants.
            </p>
          </div>
          <Link href="/admin/question-pool/new" className={`${styles.btn} ${styles.btnPrimary}`}>
            + New question
          </Link>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total questions</div>
          <div className={styles.statValue}>{total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active</div>
          <div className={styles.statValue} style={{ color: 'var(--admin-success)' }}>
            {active}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Inactive</div>
          <div className={styles.statValue} style={{ color: inactive > 0 ? 'var(--admin-warning)' : undefined }}>
            {inactive}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Products covered</div>
          <div className={styles.statValue}>{uniqueProducts}</div>
        </div>
      </div>

      <QuestionPoolList initialRows={rows} productSlugs={productSlugs} />
    </div>
  );
}
