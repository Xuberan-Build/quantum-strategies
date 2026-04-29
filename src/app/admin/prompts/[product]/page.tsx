import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import PromptEditor from './PromptEditor';
import RestoreButton from './RestoreButton';

const SCOPE_ORDER = ['system', 'step_insight', 'followup', 'final_briefing'] as const;
const SCOPE_LABELS: Record<string, string> = {
  system: 'System Prompt',
  step_insight: 'Step Insight',
  followup: 'Follow-up Response',
  final_briefing: 'Final Briefing',
};
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  system: 'Sets the AI persona and baseline behavior for every interaction in this product.',
  step_insight: 'How the AI responds after each step the user completes.',
  followup: 'How the AI handles follow-up questions within a step.',
  final_briefing: 'The generation prompt for the final deliverable document.',
};

function getDefaultFallback(scope: string, productName: string): string {
  switch (scope) {
    case 'system':
      return `You are an AI assistant helping users with ${productName}. Provide clear, helpful, and accurate responses.`;
    case 'step_insight':
      return `You are a strategic advisor for ${productName}. Analyze the user's input and provide actionable insights based on their unique situation. Be specific, practical, and encouraging.`;
    case 'followup':
      return `Continue the conversation naturally. Answer the user's question with clarity and depth. Reference previous context when relevant. Keep responses concise but thorough.`;
    case 'final_briefing':
      return `Generate a comprehensive strategic briefing based on all the information provided. Create a clear, actionable plan that synthesizes the user's goals, challenges, and the insights discussed. Format with clear sections and specific next steps.`;
    default:
      return '';
  }
}

export default async function ProductPromptsPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const { product } = await params;
  const productSlug = decodeURIComponent(product);

  const [productRes, promptsRes] = await Promise.all([
    supabaseAdmin
      .from('product_definitions')
      .select('name, product_slug')
      .eq('product_slug', productSlug)
      .maybeSingle(),
    supabaseAdmin
      .from('prompts')
      .select('id, product_slug, scope, step_number, content, version, is_active, updated_at')
      .eq('product_slug', productSlug)
      .order('scope')
      .order('version', { ascending: false }),
  ]);

  // Allow orphaned prompt-only slugs through; only 404 if nothing exists at all
  const productName = productRes.data?.name ?? formatSlug(productSlug);
  const allVersions = promptsRes.data ?? [];

  if (!productRes.data && allVersions.length === 0) notFound();

  type PromptRow = (typeof allVersions)[number];

  const activeMap = new Map<string, PromptRow>();
  const historyMap = new Map<string, PromptRow[]>();

  for (const row of allVersions) {
    const key = `${row.scope}:${row.step_number ?? ''}`;
    if (!activeMap.has(key)) {
      activeMap.set(key, row);
      historyMap.set(key, []);
    } else {
      historyMap.get(key)!.push(row);
    }
  }

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/prompts" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle}>{productName}</h1>
          <Link
            href={`/admin/products/${productSlug}`}
            style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}
          >
            View product ↗
          </Link>
        </div>
        <p className={styles.pageDescription}>
          Saving creates a new version — older versions are preserved and can be restored below.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {SCOPE_ORDER.map((scope) => {
          const key = `${scope}:`;
          const active = activeMap.get(key);
          const history = historyMap.get(key) ?? [];
          const fallback = getDefaultFallback(scope, productName);

          return (
            <div key={scope} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{SCOPE_LABELS[scope]}</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>
                    {SCOPE_DESCRIPTIONS[scope]}
                  </p>
                </div>
                {active ? (
                  <span className={`${styles.badge} ${styles.badgeSuccess}`}>v{active.version} active</span>
                ) : (
                  <span
                    className={styles.badge}
                    style={{ background: 'var(--admin-bg-subtle)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)' }}
                  >
                    using default
                  </span>
                )}
              </div>

              <PromptEditor
                productSlug={productSlug}
                scope={scope}
                initialContent={active?.content ?? ''}
                currentVersion={active?.version ?? 0}
                fallbackContent={!active ? fallback : undefined}
              />

              {history.length > 0 && (
                <details style={{ marginTop: '1rem', borderTop: '1px solid var(--admin-border)', paddingTop: '1rem' }}>
                  <summary style={{ fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--admin-text-muted)', userSelect: 'none' }}>
                    {history.length} older version{history.length !== 1 ? 's' : ''}
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {history.map((h) => (
                      <div key={h.id} style={{ padding: '0.75rem', background: 'var(--admin-bg)', borderRadius: '0.375rem', fontSize: '0.8125rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--admin-text-muted)' }}>v{h.version}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
                              {new Date(h.updated_at).toLocaleString()}
                            </span>
                          </div>
                          <RestoreButton
                            productSlug={productSlug}
                            scope={scope}
                            content={h.content}
                            version={h.version}
                          />
                        </div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--admin-text-muted)', fontSize: '0.75rem', maxHeight: '100px', overflowY: 'auto' }}>
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
