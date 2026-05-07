import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LandingPageEditor, { type LandingPageData } from '@/components/admin/LandingPageEditor';
import styles from '@/app/admin/admin-layout.module.css';

type Props = { params: Promise<{ slug: string }> };

export default async function LandingPageEditorPage({ params }: Props) {
  const { slug } = await params;

  // Verify the product exists
  const { data: product, error: productErr } = await supabaseAdmin
    .from('product_definitions')
    .select('product_slug, name')
    .eq('product_slug', slug)
    .single();

  if (productErr || !product) notFound();

  // Fetch existing landing page if any
  const { data: page } = await supabaseAdmin
    .from('product_landing_pages')
    .select('*')
    .eq('product_slug', slug)
    .maybeSingle();

  const initialData = page
    ? {
        ...page,
        features: Array.isArray(page.features) ? page.features : [],
        pricing_bullets: Array.isArray(page.pricing_bullets) ? page.pricing_bullets : [],
        faq: Array.isArray(page.faq) ? page.faq : [],
      } as LandingPageData
    : null;

  return (
    <div style={{ height: '100%' }}>
      <header className={styles.pageHeader} style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href={`/admin/products/${slug}`} className={styles.backLink} style={{ padding: 0, fontSize: '13px' }}>
            ← {product.name}
          </Link>
          <span style={{ color: 'var(--admin-border)' }}>/</span>
          <h1 className={styles.pageTitle} style={{ fontSize: '1.25rem', margin: 0 }}>Landing Page</h1>
        </div>
      </header>

      <LandingPageEditor slug={slug} initialData={initialData} />
    </div>
  );
}
