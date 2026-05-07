import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/navigation/Navbar';
import StripeCheckout from '@/components/products/StripeCheckout';
import { supabaseAdmin } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const { data: page } = await supabaseAdmin
    .from('product_landing_pages')
    .select('seo_title, seo_description, hero_headline')
    .eq('product_slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!page) return {};

  const title = page.seo_title || page.hero_headline || slug;
  return {
    title,
    description: page.seo_description ?? undefined,
    alternates: { canonical: `https://quantumstrategies.online/products/${slug}/` },
  };
}

export default async function DynamicProductPage({ params }: Props) {
  const { slug } = await params;

  const [pageRes, productRes] = await Promise.all([
    supabaseAdmin
      .from('product_landing_pages')
      .select('*')
      .eq('product_slug', slug)
      .eq('status', 'published')
      .maybeSingle(),
    supabaseAdmin
      .from('product_definitions')
      .select('name, price, product_slug')
      .eq('product_slug', slug)
      .maybeSingle(),
  ]);

  if (!pageRes.data) {
    // No published landing page — if the product exists show coming soon, else 404
    if (!productRes.data) notFound();
    return <ComingSoon name={productRes.data.name} />;
  }

  const page = pageRes.data;
  const product = productRes.data;

  const features: Array<{ id: string; icon: string; title: string; body: string }> =
    Array.isArray(page.features) ? page.features : [];

  const pricingBullets: string[] =
    Array.isArray(page.pricing_bullets) ? page.pricing_bullets.filter(Boolean) : [];

  const faq: Array<{ id: string; question: string; answer: string }> =
    Array.isArray(page.faq) ? page.faq : [];

  return (
    <div style={{ minHeight: '100vh', background: '#030048', color: '#F8F5FF', overflowX: 'hidden' }}>
      <Navbar showProductCTA productCTAText={page.hero_cta_label ?? 'Get Started'} productCTAHref="#purchase" />

      {/* Hero */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 2rem 4rem' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #030048 0%, #090018 50%, #030048 100%)', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', textAlign: 'center' }}>
          {page.badge && (
            <div style={{ display: 'inline-block', padding: '0.5rem 1.25rem', background: 'rgba(147,51,234,0.15)', border: '1px solid rgba(192,132,252,0.3)', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: '#c084fc', marginBottom: '1.5rem' }}>
              {page.badge}
            </div>
          )}
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '0.75rem' }}>
            {page.hero_headline}
            {page.hero_accent && (
              <span style={{ display: 'block', fontStyle: 'italic', background: 'linear-gradient(135deg, #c084fc, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {page.hero_accent}
              </span>
            )}
          </h1>
          {page.hero_description && (
            <p style={{ fontSize: '1.125rem', color: 'rgba(248,245,255,0.75)', maxWidth: '600px', margin: '1.5rem auto', lineHeight: 1.7 }}>
              {page.hero_description}
            </p>
          )}
          {page.hero_microcopy && (
            <p style={{ fontSize: '0.875rem', color: 'rgba(248,245,255,0.5)', marginBottom: '1.5rem' }}>
              {page.hero_microcopy}
            </p>
          )}
          <a href="#purchase" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 2rem', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#fff', borderRadius: '0.5rem', fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}>
            {page.hero_cta_label || 'Get Started'}
          </a>
        </div>
      </section>

      {/* Features */}
      {features.length > 0 && (
        <section style={{ padding: '5rem 2rem', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 700, marginBottom: '3rem' }}>
              What You Will Discover
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {features.map((f) => (
                <div key={f.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: '1rem', padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#c084fc' }}>{f.title}</h3>
                  <p style={{ fontSize: '0.9375rem', color: 'rgba(248,245,255,0.7)', lineHeight: 1.7, margin: 0 }}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Purchase */}
      <section id="purchase" style={{ padding: '5rem 2rem' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(192,132,252,0.25)', borderRadius: '1.5rem', padding: '3rem', textAlign: 'center' }}>
          {page.pricing_headline && (
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>{page.pricing_headline}</h2>
          )}
          {product && (
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '3rem', fontWeight: 800 }}>${product.price}</span>
              <span style={{ color: 'rgba(248,245,255,0.5)', marginLeft: '0.5rem' }}>one-time</span>
            </div>
          )}
          {pricingBullets.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', textAlign: 'left' }}>
              {pricingBullets.map((b, i) => (
                <li key={i} style={{ padding: '0.5rem 0', color: 'rgba(248,245,255,0.8)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#a78bfa' }}>✓</span> {b}
                </li>
              ))}
            </ul>
          )}
          {product && (
            <StripeCheckout
              productSlug={slug}
              productName={product.name ?? ''}
              price={product.price ?? 0}
            />
          )}
          <p style={{ fontSize: '0.8125rem', color: 'rgba(248,245,255,0.4)', marginTop: '1rem' }}>
            Secure checkout · Instant delivery · No recurring charges
          </p>
        </div>
      </section>

      {/* FAQ */}
      {faq.length > 0 && (
        <section style={{ padding: '5rem 2rem', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 700, marginBottom: '3rem' }}>
              Common Questions
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {faq.map((item) => (
                <div key={item.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#e2e8f0' }}>{item.question}</h3>
                  <p style={{ fontSize: '0.9375rem', color: 'rgba(248,245,255,0.65)', lineHeight: 1.7, margin: 0 }}>{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#030048', color: '#F8F5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{name}</h1>
        <p style={{ color: 'rgba(248,245,255,0.5)' }}>This experience is coming soon.</p>
      </div>
    </div>
  );
}
