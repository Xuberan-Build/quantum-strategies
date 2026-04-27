import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
  pillarTitle?: string;
  pillarSlug?: string;
  source: "db" | "mdx";
}

async function getDbArticles(): Promise<Article[]> {
  const { data } = await supabaseAdmin
    .from("content_posts")
    .select("slug, title, excerpt, published_at, content_pillars(title, slug)")
    .eq("is_published", true)
    .eq("type", "blog")
    .order("published_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((p) => {
    const pillar = (Array.isArray(p.content_pillars) ? p.content_pillars[0] : p.content_pillars) as { title: string; slug: string } | null;
    return {
      slug: p.slug,
      title: p.title,
      description: p.excerpt ?? "",
      date: p.published_at ?? "",
      pillarTitle: pillar?.title,
      pillarSlug: pillar?.slug,
      source: "db" as const,
    };
  });
}

function getMdxArticles(): Article[] {
  const articlesDir = path.join(process.cwd(), "src/content/articles");
  const categories = ["customer-acquisition", "operations", "product-development", "waveforms"];
  const articles: Article[] = [];

  categories.forEach((category) => {
    const categoryDir = path.join(articlesDir, category);
    if (!fs.existsSync(categoryDir)) return;
    fs.readdirSync(categoryDir)
      .filter((f) => f.endsWith(".mdx"))
      .forEach((file) => {
        const content = fs.readFileSync(path.join(categoryDir, file), "utf-8");
        const { data } = matter(content);
        articles.push({
          slug: file.replace(".mdx", ""),
          title: data.title || file.replace(".mdx", ""),
          description: data.description || "",
          date: data.date || "",
          source: "mdx",
        });
      });
  });

  return articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const metadata = {
  title: "Articles | Quantum Strategies",
  description: "Strategic insights on consciousness, business, and the quantum architecture of growth.",
  alternates: {
    canonical: "https://quantumstrategies.online/articles/",
  },
};

export default async function ArticlesPage() {
  const [dbArticles, mdxArticles] = await Promise.all([
    getDbArticles(),
    Promise.resolve(getMdxArticles()),
  ]);

  return (
    <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "4rem 1rem" }}>
      <header style={{ marginBottom: "3rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem", color: "#fff" }}>Articles</h1>
        <p style={{ fontSize: "1.25rem", color: "var(--ink-soft)", maxWidth: "600px", margin: "0 auto" }}>
          Frameworks for consciousness, strategy, and aligned growth
        </p>
      </header>

      {/* DB-sourced articles */}
      {dbArticles.length > 0 && (
        <section style={{ marginBottom: "4rem" }}>
          <h2 style={{
            fontSize: "1.5rem", marginBottom: "2rem", color: "#fff",
            borderBottom: "2px solid var(--accent)", paddingBottom: "0.5rem",
          }}>
            Latest
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "2rem" }}>
            {dbArticles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                style={{
                  display: "block", padding: "1.5rem",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
                  transition: "all 0.2s", textDecoration: "none",
                }}
                className="article-card"
              >
                {article.pillarTitle && (
                  <div style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {article.pillarTitle}
                  </div>
                )}
                <h3 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "#fff" }}>{article.title}</h3>
                {article.description && (
                  <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", lineHeight: "1.6" }}>{article.description}</p>
                )}
                {article.date && (
                  <time style={{ display: "block", marginTop: "1rem", color: "var(--accent)", fontSize: "0.875rem" }}>
                    {new Date(article.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </time>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* MDX archive */}
      {mdxArticles.length > 0 && (
        <section>
          <h2 style={{
            fontSize: "1.5rem", marginBottom: "2rem", color: "#fff",
            borderBottom: "2px solid var(--accent)", paddingBottom: "0.5rem",
          }}>
            Archive
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "2rem" }}>
            {mdxArticles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                style={{
                  display: "block", padding: "1.5rem",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.07)",
                  transition: "all 0.2s", textDecoration: "none",
                }}
                className="article-card"
              >
                <h3 style={{ fontSize: "1.125rem", marginBottom: "0.75rem", color: "#fff" }}>{article.title}</h3>
                {article.description && (
                  <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", lineHeight: "1.6" }}>{article.description}</p>
                )}
                {article.date && (
                  <time style={{ display: "block", marginTop: "1rem", color: "var(--ink-soft)", fontSize: "0.8rem" }}>
                    {new Date(article.date).getFullYear()}
                  </time>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {dbArticles.length === 0 && mdxArticles.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--ink-soft)" }}>Articles coming soon.</p>
      )}
    </div>
  );
}
