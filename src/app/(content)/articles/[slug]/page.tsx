import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { MDXRemote, compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { proseComponents } from "@/components/content/proseComponents";
import { isPublicSlug } from "@/lib/seo/sitemap";
import { extractFaq, faqJsonLd } from "@/lib/content/faq";
import { getDbArticles } from "@/lib/content/article-list";
import { relatedFor } from "@/lib/content/article-index";
import ArticleCta from "@/components/content/ArticleCta";
import styles from "./article.module.css";

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ── MDX fallback helpers ────────────────────────────────────────────────────

function getAllMdxArticles() {
  const articlesDir = path.join(process.cwd(), "src/content/articles");
  const categories = ["customer-acquisition", "operations", "product-development", "waveforms"];
  const articles: { slug: string; filePath: string }[] = [];

  categories.forEach((category) => {
    const categoryDir = path.join(articlesDir, category);
    if (!fs.existsSync(categoryDir)) return;
    fs.readdirSync(categoryDir)
      .filter((f) => f.endsWith(".mdx"))
      .forEach((file) =>
        articles.push({ slug: file.replace(".mdx", ""), filePath: path.join(categoryDir, file) })
      );
  });

  return articles.filter((a) => isPublicSlug(a.slug));
}

// ── DB body rendering ───────────────────────────────────────────────────────
// DB bodies can come from model output. Compile first; if the MDX doesn't parse,
// show it as plain paragraphs instead of failing the whole page.
async function renderDbBody(source: string) {
  try {
    const { content } = await compileMDX({ source, components: proseComponents });
    return content;
  } catch (err) {
    console.error("[articles] MDX compile failed; rendering as plain text", err);
    return (
      <>
        {source
          .split(/\n{2,}/)
          .filter((para) => para.trim())
          .map((para, i) => (
            <p key={i}>{para}</p>
          ))}
      </>
    );
  }
}

// ── Static params (MDX slugs; DB slugs render dynamically) ────────────────

// DB posts (including a slug that 404'd before it was published) refresh within five minutes.
export const revalidate = 300;

export async function generateStaticParams() {
  return getAllMdxArticles().map((a) => ({ slug: a.slug }));
}

// ── Metadata ──────────────────────────────────────────────────────────────

const BASE_URL = "https://quantumstrategies.online";

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  // "_"-prefixed slugs are templates/drafts (e.g. the seeded `_pillar` row), never pages.
  if (!isPublicSlug(slug)) return { title: "Not Found", robots: { index: false, follow: true } };
  const canonical = `${BASE_URL}/articles/${slug}/`;

  // Try DB first
  const { data: post } = await supabaseAdmin
    .from("content_posts")
    .select("title, excerpt, published_at, updated_at, author")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (post) {
    const title = post.title;
    const description = post.excerpt ?? undefined;
    const author = post.author || "Quantum Strategies";
    return {
      title: `${title} | Quantum Strategies`,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        type: "article",
        url: canonical,
        siteName: "Quantum Strategies",
        publishedTime: post.published_at ?? undefined,
        modifiedTime: post.updated_at ?? undefined,
        authors: [author],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  }

  // MDX fallback
  const article = getAllMdxArticles().find((a) => a.slug === slug);
  if (!article || !fs.existsSync(article.filePath)) return { title: "Not Found" };

  const { data } = matter(fs.readFileSync(article.filePath, "utf-8"));
  const title = data.title as string;
  const description = data.description as string | undefined;
  const author = (data.author as string | undefined) || "Quantum Strategies";
  return {
    title: `${title} | Quantum Strategies`,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      siteName: "Quantum Strategies",
      publishedTime: data.date ? new Date(data.date as string).toISOString() : undefined,
      authors: [author],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  if (!isPublicSlug(slug)) notFound();

  // ── DB post ──────────────────────────────────────────────────────────────
  const { data: post } = await supabaseAdmin
    .from("content_posts")
    .select("*, content_pillars(title, slug)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (post) {
    const pillar = post.content_pillars as { title: string; slug: string } | null;
    const articleUrl = `${BASE_URL}/articles/${slug}/`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.excerpt ?? undefined,
      datePublished: post.published_at ?? undefined,
      dateModified: post.updated_at,
      author: { "@type": "Person", name: post.author || "Austin Santos", url: `${BASE_URL}/meet/` },
      publisher: { "@type": "Organization", name: "Quantum Strategies", url: BASE_URL },
      mainEntityOfPage: articleUrl,
      url: articleUrl,
      // Taxonomy tags ("pillar:p2") are internal; only plain keyword tags are public.
      keywords: (post.tags as string[] | null)?.filter((t) => !t.includes(":")).join(", ") || undefined,
      articleSection: pillar?.title,
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Articles", item: `${BASE_URL}/articles/` },
        { "@type": "ListItem", position: 3, name: post.title, item: articleUrl },
      ],
    };
    const faqLd = faqJsonLd(extractFaq(post.body ?? ""));
    const author = post.author || "Austin Santos";
    const related = relatedFor(slug, await getDbArticles());

    return (
      <div className={styles.page}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        {faqLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
        )}
        <section className={styles.hero}>
          <div className={styles.heroBg} />
          <div className={styles.gridOverlay} />
          <div className={styles.heroInner}>
            <Link href="/articles/" className={styles.back}>← Articles</Link>
            {pillar && (
              <Link href={`/pillars/${pillar.slug}/`} className={styles.category}>
                {pillar.title}
              </Link>
            )}
            <h1 className={styles.title}>{post.title}</h1>
            {post.excerpt && <p className={styles.description}>{post.excerpt}</p>}
            <Link href="/meet/" className={styles.byline} rel="author">By {author}</Link>
            {post.published_at && (
              <time className={styles.date} dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                })}
              </time>
            )}
          </div>
        </section>
        <div className={styles.divider} />
        <article className={`article-prose ${styles.prose}`}>
          {await renderDbBody(post.body ?? "")}
        </article>
        <ArticleCta slug={slug} />
        {(related.series || related.more.length > 0) && (
          <nav className={styles.related} aria-label="Keep reading">
            {related.series && (related.series.prev || related.series.next) && (
              <div className={styles.seriesNav}>
                <div className={styles.relatedLabel}>{related.series.title}</div>
                <div className={styles.seriesLinks}>
                  {related.series.prev ? (
                    <Link href={`/articles/${related.series.prev.slug}/`} className={styles.seriesLink}>
                      <span className={styles.seriesDir}>← Previous</span>
                      {related.series.prev.title}
                    </Link>
                  ) : <span />}
                  {related.series.next && (
                    <Link href={`/articles/${related.series.next.slug}/`} className={`${styles.seriesLink} ${styles.seriesNext}`}>
                      <span className={styles.seriesDir}>Next →</span>
                      {related.series.next.title}
                    </Link>
                  )}
                </div>
              </div>
            )}
            {related.more.length > 0 && (
              <div>
                <div className={styles.relatedLabel}>More on {pillar?.title ?? "this topic"}</div>
                <ul className={styles.relatedList}>
                  {related.more.map((a) => (
                    <li key={a.slug}>
                      <Link href={`/articles/${a.slug}/`} className={styles.relatedCard}>
                        <span className={styles.relatedTitle}>{a.title}</span>
                        <span className={styles.relatedMeta}>{a.readingMinutes} min read</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </nav>
        )}
      </div>
    );
  }

  // ── MDX fallback ──────────────────────────────────────────────────────────
  const article = getAllMdxArticles().find((a) => a.slug === slug);
  if (!article || !fs.existsSync(article.filePath)) notFound();

  const fileContent = fs.readFileSync(article.filePath, "utf-8");
  const { data, content } = matter(fileContent);
  const articleUrl = `${BASE_URL}/articles/${slug}/`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description: data.description,
    datePublished: data.date || undefined,
    author: { "@type": "Person", name: (data.author as string) || "Austin Santos", url: `${BASE_URL}/meet/` },
    publisher: { "@type": "Organization", name: "Quantum Strategies", url: BASE_URL },
    mainEntityOfPage: articleUrl,
    url: articleUrl,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Articles", item: `${BASE_URL}/articles/` },
      { "@type": "ListItem", position: 3, name: data.title as string, item: articleUrl },
    ],
  };

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.gridOverlay} />
        <div className={styles.heroInner}>
          <Link href="/articles/" className={styles.back}>← Articles</Link>
          {data.category && <div className={styles.category}>{data.category}</div>}
          <h1 className={styles.title}>{data.title as string}</h1>
          {data.description && <p className={styles.description}>{data.description as string}</p>}
          {data.date && (
            <time className={styles.date}>
              {new Date(data.date as string).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </time>
          )}
        </div>
      </section>
      <div className={styles.divider} />
      <article className={`article-prose ${styles.prose}`}>
        <MDXRemote source={content} components={proseComponents} />
      </article>
      <ArticleCta slug={slug} />
    </div>
  );
}
