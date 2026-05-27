import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import QuestionPoolForm, { type QuestionPoolRow } from '@/components/admin/QuestionPoolForm';

async function getProductSlugs(): Promise<string[]> {
  const { data: products } = await supabaseAdmin
    .from('product_definitions')
    .select('product_slug')
    .order('product_slug', { ascending: true });

  const { data: existing } = await supabaseAdmin
    .from('question_pool')
    .select('product_slug');

  const slugSet = new Set<string>();
  products?.forEach((p) => slugSet.add(p.product_slug));
  existing?.forEach((p) => slugSet.add(p.product_slug));
  return Array.from(slugSet).sort();
}

export default async function QuestionPoolEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === 'new';

  const productSlugs = await getProductSlugs();

  if (isNew) {
    return (
      <div>
        <header className={styles.pageHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Link href="/admin/question-pool" className={styles.backLink} style={{ padding: 0 }}>
              <BackIcon />
            </Link>
            <h1 className={styles.pageTitle}>New question</h1>
          </div>
          <p className={styles.pageDescription}>
            Add a question to the pool. Suggested id format: <code>&lt;product&gt;.&lt;step&gt;.&lt;role&gt;.&lt;n&gt;</code>
          </p>
        </header>

        <QuestionPoolForm mode="create" productSlugs={productSlugs} />
      </div>
    );
  }

  const { data: question, error } = await supabaseAdmin
    .from('question_pool')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !question) {
    notFound();
  }

  const typed = question as QuestionPoolRow;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/question-pool" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle} style={{ fontFamily: 'monospace', fontSize: '1.25rem' }}>
            {typed.id}
          </h1>
        </div>
        <p className={styles.pageDescription}>
          {typed.product_slug} · step {typed.step_index} · {typed.rite} · {typed.question_role}
          {!typed.active && ' · inactive'}
        </p>
      </header>

      <QuestionPoolForm
        mode="edit"
        initial={{
          id: typed.id,
          product_slug: typed.product_slug,
          step_index: typed.step_index,
          domain: typed.domain,
          rite: typed.rite,
          question_role: typed.question_role,
          experience_level: typed.experience_level,
          audience_tracks: typed.audience_tracks ?? ['all'],
          prompt_text: typed.prompt_text,
          prompt_variants: typed.prompt_variants ?? null,
          followup_text: typed.followup_text ?? null,
          unlocks: typed.unlocks ?? null,
          blocks: typed.blocks ?? null,
          signals_extracted: typed.signals_extracted ?? null,
          active: typed.active,
        }}
        productSlugs={productSlugs}
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
