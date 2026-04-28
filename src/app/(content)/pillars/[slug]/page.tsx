import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import styles from "../pillar.module.css";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const { data: pillar } = await supabaseAdmin
    .from("content_pillars")
    .select("title, description")
    .eq("slug", slug)
    .maybeSingle();

  if (!pillar) return { title: "Not Found" };

  return {
    title: `${pillar.title} | Quantum Strategies`,
    description: pillar.description ?? undefined,
    alternates: { canonical: `https://quantumstrategies.online/pillars/${slug}/` },
  };
}

const TRADITION_COLORS: Record<string, string> = {
  taoism: "#10b981", kabbalah: "#8b5cf6", tantra: "#ef4444",
  sufism: "#f59e0b", christian_mysticism: "#3b82f6", hermeticism: "#a855f7",
  rosicrucianism: "#d97706", science: "#06b6d4", buddhism: "#f97316", hinduism: "#fb923c",
};

function traditionLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PLG_LABEL: Record<string, string> = {
  awareness: "Free", interest: "Lead Magnet",
  consideration: "Entry", conversion: "Core", expansion: "High Ticket",
};

export default async function PillarPage({ params }: PageProps) {
  const { slug } = await params;

  const { data: pillar } = await supabaseAdmin
    .from("content_pillars")
    .select("id, slug, title, description, tradition_affinity")
    .eq("slug", slug)
    .maybeSingle();

  if (!pillar) notFound();

  const [topicsRes, articlesRes, productsRes] = await Promise.all([
    supabaseAdmin
      .from("content_topics")
      .select("id, title, description, theme_tags")
      .eq("pillar_id", pillar.id)
      .order("created_at"),
    supabaseAdmin
      .from("content_posts")
      .select("slug, title, excerpt, published_at")
      .eq("is_published", true)
      .eq("pillar_id", pillar.id)
      .order("published_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("product_definitions")
      .select("id, product_slug, name, description, price, plg_stage")
      .eq("is_active", true)
      .eq("pillar_id", pillar.id)
      .order("price"),
  ]);

  const topics   = topicsRes.data   ?? [];
  const articles = articlesRes.data ?? [];
  const products = productsRes.data ?? [];
  const traditions = (pillar.tradition_affinity ?? []) as string[];

  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.gridOverlay} />
        <div className={styles.glowOrb} />
        <div className={styles.heroInner}>
          <div className={styles.container}>
            <Link href="/pillars" className={styles.breadcrumb}>
              ← All Pillars
            </Link>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              Strategic Pillar
            </div>
            <h1 className={styles.heroTitle}>{pillar.title}</h1>
            {pillar.description && (
              <p className={styles.heroDesc}>{pillar.description}</p>
            )}
            {traditions.length > 0 && (
              <div className={styles.traditions}>
                {traditions.map((t) => (
                  <span
                    key={t}
                    className={styles.traditionTag}
                    style={{
                      color: TRADITION_COLORS[t] ?? "#6b7280",
                      borderColor: TRADITION_COLORS[t] ?? "#6b7280",
                    }}
                  >
                    {traditionLabel(t)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Topics ── */}
      {topics.length > 0 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <p className={styles.sectionLabel}>Covered Terrain</p>
            <h2 className={styles.sectionTitle}>Topics</h2>
            <div className={styles.topicList}>
              {topics.map((topic) => (
                <div key={topic.id} className={styles.topicCard}>
                  <div className={styles.topicTitle}>{topic.title}</div>
                  {topic.description && (
                    <div className={styles.topicDesc}>{topic.description}</div>
                  )}
                  {((topic.theme_tags as string[] | null) ?? []).length > 0 && (
                    <div className={styles.tags}>
                      {(topic.theme_tags as string[]).map((tag) => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Articles ── */}
      {articles.length > 0 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <p className={styles.sectionLabel}>Reading</p>
            <h2 className={styles.sectionTitle}>Articles</h2>
            <div className={styles.grid}>
              {articles.map((article) => (
                <Link key={article.slug} href={`/articles/${article.slug}`} className={styles.articleCard}>
                  {article.published_at && (
                    <time className={styles.articleDate}>
                      {new Date(article.published_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </time>
                  )}
                  <div className={styles.articleTitle}>{article.title}</div>
                  {article.excerpt && (
                    <p className={styles.articleExcerpt}>
                      {article.excerpt.slice(0, 120)}{article.excerpt.length > 120 ? "…" : ""}
                    </p>
                  )}
                  <span className={styles.articleArrow}>Read →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Products ── */}
      {products.length > 0 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <p className={styles.sectionLabel}>Go Deeper</p>
            <h2 className={styles.sectionTitle}>Products</h2>
            <div className={styles.productGrid}>
              {products.map((product) => (
                <Link key={product.id} href={`/products/${product.product_slug}`} className={styles.productCard}>
                  {product.plg_stage && (
                    <div className={styles.plgBadge}>
                      {PLG_LABEL[product.plg_stage] ?? product.plg_stage}
                    </div>
                  )}
                  <div className={styles.productName}>{product.name}</div>
                  {product.description && (
                    <p className={styles.productDesc}>
                      {String(product.description).slice(0, 100)}…
                    </p>
                  )}
                  {product.price != null && (
                    <div className={styles.productPrice}>
                      {product.price === 0 ? "Free" : `$${product.price}`}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {topics.length === 0 && articles.length === 0 && products.length === 0 && (
        <div className={styles.container}>
          <p className={styles.empty}>Content for this pillar is being developed.</p>
        </div>
      )}
    </div>
  );
}
