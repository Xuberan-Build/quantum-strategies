import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

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

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "4rem 1.25rem" }}>
      <Link href="/pillars" style={{ fontSize: "0.875rem", color: "var(--ink-soft)", textDecoration: "none", display: "inline-block", marginBottom: "2rem" }}>
        ← All Pillars
      </Link>

      <header style={{ marginBottom: "3rem" }}>
        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {(pillar.tradition_affinity ?? []).map((t: string) => (
            <span key={t} style={{
              fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.08em", color: TRADITION_COLORS[t] ?? "#6b7280",
              padding: "3px 10px", border: `1px solid ${TRADITION_COLORS[t] ?? "#6b7280"}`,
              borderRadius: 4,
            }}>
              {traditionLabel(t)}
            </span>
          ))}
        </div>
        <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", color: "#fff", marginBottom: "1.25rem" }}>
          {pillar.title}
        </h1>
        <p style={{ fontSize: "1.125rem", color: "var(--ink-soft)", lineHeight: 1.8, maxWidth: "72ch" }}>
          {pillar.description}
        </p>
      </header>

      {topics.length > 0 && (
        <section style={{ marginBottom: "3.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", color: "#fff", marginBottom: "1.25rem", fontWeight: 700 }}>Topics</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {topics.map((topic) => (
              <div key={topic.id} style={{
                padding: "1rem 1.5rem",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "8px",
              }}>
                <div style={{ fontWeight: 600, color: "#fff", marginBottom: topic.description ? "0.375rem" : 0 }}>
                  {topic.title}
                </div>
                {topic.description && (
                  <div style={{ fontSize: "0.9rem", color: "var(--ink-soft)", lineHeight: 1.6 }}>
                    {topic.description}
                  </div>
                )}
                {(topic.theme_tags as string[] | null ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                    {(topic.theme_tags as string[]).map((tag) => (
                      <span key={tag} style={{
                        fontSize: "0.6875rem", color: "var(--ink-soft)",
                        padding: "2px 8px", border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 4,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {articles.length > 0 && (
        <section style={{ marginBottom: "3.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", color: "#fff", marginBottom: "1.25rem", fontWeight: 700 }}>Articles</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                style={{
                  display: "block", padding: "1.25rem 1.5rem", textDecoration: "none",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "8px", transition: "all 0.2s",
                }}
                className="article-card"
              >
                <div style={{ fontWeight: 600, color: "#fff", marginBottom: "0.5rem", lineHeight: 1.4 }}>
                  {article.title}
                </div>
                {article.excerpt && (
                  <p style={{ fontSize: "0.875rem", color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }}>
                    {article.excerpt.slice(0, 120)}
                    {article.excerpt.length > 120 ? "…" : ""}
                  </p>
                )}
                {article.published_at && (
                  <time style={{ display: "block", fontSize: "0.8rem", color: "var(--accent)", marginTop: "0.75rem" }}>
                    {new Date(article.published_at).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </time>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.25rem", color: "#fff", marginBottom: "1.25rem", fontWeight: 700 }}>Products</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.product_slug}`}
                style={{
                  display: "block", padding: "1.25rem 1.5rem", textDecoration: "none",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "8px", transition: "all 0.2s",
                }}
                className="article-card"
              >
                {product.plg_stage && (
                  <div style={{ fontSize: "0.6875rem", color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.375rem" }}>
                    {PLG_LABEL[product.plg_stage] ?? product.plg_stage}
                  </div>
                )}
                <div style={{ fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>{product.name}</div>
                {product.description && (
                  <p style={{ fontSize: "0.875rem", color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }}>
                    {String(product.description).slice(0, 100)}…
                  </p>
                )}
                {product.price != null && (
                  <div style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 700, marginTop: "0.75rem" }}>
                    {product.price === 0 ? "Free" : `$${product.price}`}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {topics.length === 0 && articles.length === 0 && products.length === 0 && (
        <p style={{ color: "var(--ink-soft)" }}>Content for this pillar is being developed.</p>
      )}
    </div>
  );
}
