import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import PromptEditor from './PromptEditor';

const SCOPE_ORDER = ['system', 'step_insight', 'followup', 'final_briefing'];
const SCOPE_LABELS: Record<string, string> = {
  system: 'System Prompt',
  step_insight: 'Step Insight',
  followup: 'Follow-up Response',
  final_briefing: 'Final Briefing',
};
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  system: 'Sets the AI persona and baseline behavior for every interaction in this product.',
  step_insight: 'How the AI responds when analyzing a user\'s step input.',
  followup: 'How the AI handles follow-up questions within a step.',
  final_briefing: 'The generation prompt for the final deliverable document.',
};

export default async function ProductPromptsPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const { product } = await params;
  const productSlug = decodeURIComponent(product);

  // Load all versions for this product to show history
  const { data: allVersions } = await supabaseAdmin
    .from('prompts')
    .select('id, product_slug, scope, step_number, content, version, is_active, updated_at')
    .eq('product_slug', productSlug)
    .order('scope')
    .order('version', { ascending: false });

  // Get active prompts (latest per scope)
  const activeMap = new Map<string, (typeof allVersions)[0]>();
  const historyMap = new Map<string, (typeof allVersions)>();

  for (const row of allVersions ?? []) {
    const key = `${row.scope}:${row.step_number ?? ''}`;
    if (!activeMap.has(key)) {
      activeMap.set(key, row);
      historyMap.set(key, []);
    } else {
      historyMap.get(key)!.push(row);
    }
  }

  const scopes = SCOPE_ORDER.filter((s) => {
    // Show all standard scopes regardless of whether they exist in DB
    return true;
  });

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/prompts" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle}>{formatSlug(productSlug)}</h1>
        </div>
        <p className={styles.pageDescription}>
          Edit AI prompts for this product. Saving creates a new version — old versions are preserved.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {scopes.map((scope) => {
          const key = `${scope}:`;
          const active = activeMap.get(key);
          const history = historyMap.get(key) ?? [];

          return (
            <div key={scope} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{SCOPE_LABELS[scope]}</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>
                    {SCOPE_DESCRIPTIONS[scope]}
                  </p>
                </div>
                {active && (
                  <span className={`${styles.badge} ${styles.badgeSuccess}`}>v{active.version} active</span>
                )}
              </div>

              <PromptEditor
                productSlug={productSlug}
                scope={scope}
                initialContent={active?.content ?? ''}
                currentVersion={active?.version ?? 0}
              />

              {history.length > 0 && (
                <details style={{ marginTop: '1rem', borderTop: '1px solid var(--admin-border)', paddingTop: '1rem' }}>
                  <summary style={{ fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--admin-text-muted)', userSelect: 'none' }}>
                    {history.length} older version{history.length !== 1 ? 's' : ''}
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {history.map((h) => (
                      <div key={h.id} style={{ padding: '0.75rem', background: 'var(--admin-bg)', borderRadius: '0.375rem', fontSize: '0.8125rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--admin-text-muted)' }}>v{h.version}</span>
                          <span style={{ color: 'var(--admin-text-muted)' }}>{new Date(h.updated_at).toLocaleString()}</span>
                        </div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--admin-text-muted)', fontSize: '0.75rem', maxHeight: '120px', overflowY: 'auto' }}>
                          {h.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatSlug(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function BackIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
