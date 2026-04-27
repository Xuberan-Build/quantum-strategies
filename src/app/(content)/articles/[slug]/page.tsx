import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
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

  return articles;
}

// ── Static params (MDX slugs; DB slugs render dynamically) ────────────────

export async function generateStaticParams() {
  return getAllMdxArticles().map((a) => ({ slug: a.slug }));
}

// ── Metadata ──────────────────────────────────────────────────────────────

const BASE_URL = "https://quantumstrategies.online";

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
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

    return (
      <article className={styles.article}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <header className={styles.header}>
          {pillar && (
            <Link href={`/pillars/${pillar.slug}`} className={styles.category}>
              {pillar.title}
            </Link>
          )}
          <h1 className={styles.title}>{post.title}</h1>
          {post.excerpt && <p className={styles.description}>{post.excerpt}</p>}
          {post.published_at && (
            <time className={styles.date}>
              {new Date(post.published_at).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </time>
          )}
        </header>
        <div className={`article-prose ${styles.prose}`}>
          <MDXRemote source={post.body ?? ""} />
        </div>
      </article>
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
    <article className={styles.article}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <header className={styles.header}>
        {data.category && <div className={styles.category}>{data.category}</div>}
        <h1 className={styles.title}>{data.title}</h1>
        {data.description && <p className={styles.description}>{data.description}</p>}
        {data.date && (
          <time className={styles.date}>{new Date(data.date).getFullYear()}</time>
        )}
      </header>
      <div className={`article-prose ${styles.prose}`}>
        <MDXRemote source={content} />
      </div>
    </article>
  );
}
