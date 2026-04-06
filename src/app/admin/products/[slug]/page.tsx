import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProductSettingsForm from '@/components/admin/ProductSettingsForm';
import styles from '../../admin-layout.module.css';

interface ProductStep {
  step: number;
  title: string;
  subtitle?: string;
  question?: string;
  prompt?: string;
  required?: boolean;
  max_follow_ups?: number;
  allow_file_upload?: boolean;
  text_input?: {
    label?: string;
    placeholder?: string;
    min_length?: number;
  };
  text_inputs?: Array<{
    key: string;
    label?: string;
    placeholder?: string;
    min_length?: number;
  }>;
}

interface ProductDefinition {
  id: string;
  product_slug: string;
  name: string;
  description: string | null;
  price: number | null;
  total_steps: number;
  estimated_duration: string | null;
  model: string;
  system_prompt: string;
  final_deliverable_prompt: string;
  steps: ProductStep[];
  is_active: boolean;
  is_purchasable: boolean;
  product_group: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

// Auth is handled by middleware.ts
export default async function ProductConfigurePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fetch product
  const { data: product, error } = await supabaseAdmin
    .from('product_definitions')
    .select('*')
    .eq('product_slug', slug)
    .single();

  if (error || !product) {
    notFound();
  }

  const typedProduct = product as ProductDefinition;

  // Fetch session stats via aggregated view (no full table scan)
  const { data: sessionStats } = await supabaseAdmin
    .from('product_session_stats')
    .select('total_sessions, completed_sessions')
    .eq('product_slug', slug)
    .maybeSingle();

  const totalSessions = sessionStats?.total_sessions || 0;
  const completedSessions = sessionStats?.completed_sessions || 0;
  const completionRate = totalSessions > 0
    ? Math.round((completedSessions / totalSessions) * 100)
    : 0;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/products" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle}>{typedProduct.name}</h1>
        </div>
        <p className={styles.pageDescription}>
          {typedProduct.product_slug} · {typedProduct.total_steps} steps · {typedProduct.model || 'gpt-4'}
        </p>
      </header>

      {/* Stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Sessions</div>
          <div className={styles.statValue}>{totalSessions}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{completedSessions}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completion Rate</div>
          <div className={styles.statValue}>{completionRate}%</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Last Updated</div>
          <div className={styles.statValue} style={{ fontSize: '1rem' }}>
            {new Date(typedProduct.updated_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <ProductSettingsForm product={typedProduct} />
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
