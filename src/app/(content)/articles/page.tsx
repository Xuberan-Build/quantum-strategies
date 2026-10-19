import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import { isPublicSlug } from "@/lib/seo/sitemap";
import ArticleBrowser from "@/components/content/ArticleBrowser";
import { getDbArticles } from "@/lib/content/article-list";
import styles from "@/components/content/ArticleBrowser.module.css";
import {
  MDX_FOLDER_TOPICS,
  buildSeries,
  mergeArticles,
  readingMinutes,
  topicCounts,
  topicSlug,
  type IndexArticle,
} from "@/lib/content/article-index";

// New DB posts appear within five minutes without a redeploy.
export const revalidate = 300;

const BASE_URL = "https://quantumstrategies.online";

function getMdxArticles(): IndexArticle[] {
  const articlesDir = path.join(process.cwd(), "src/content/articles");
  const articles: IndexArticle[] = [];

  Object.entries(MDX_FOLDER_TOPICS).forEach(([folder, topic]) => {
    const folderDir = path.join(articlesDir, folder);
    if (!fs.existsSync(folderDir)) return;
    fs.readdirSync(folderDir)
      .filter((f) => f.endsWith(".mdx") && isPublicSlug(f.replace(".mdx", "")))
      .forEach((file) => {
        const { data, content } = matter(fs.readFileSync(path.join(folderDir, file), "utf-8"));
        articles.push({
          slug: file.replace(".mdx", ""),
          title: data.title || file.replace(".mdx", ""),
          description: data.description || "",
          date: data.date ? new Date(data.date).toISOString() : "",
          topic,
          topicSlug: topicSlug(topic),
          tags: [],
          readingMinutes: readingMinutes(content),
        });
      });
  });

  return articles;
}

export const metadata = {
  title: "Articles | Quantum Strategies",
  description:
    "Articles on attention, self-image, perception and aligned business strategy. Browse by topic or start with a series.",
  alternates: {
    canonical: `${BASE_URL}/articles/`,
  },
};

export default async function ArticlesPage() {
  const articles = mergeArticles(await getDbArticles(), getMdxArticles());
  const series = buildSeries(articles);
  const topics = topicCounts(articles);

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Articles",
    url: `${BASE_URL}/articles/`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: articles.slice(0, 50).map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}/articles/${a.slug}/`,
        name: a.title,
      })),
    },
  };

  return (
    <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "4rem 1rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <header style={{ marginBottom: "3rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem", color: "#fff" }}>Articles</h1>
        <p style={{ fontSize: "1.25rem", color: "var(--ink-soft)", maxWidth: "640px", margin: "0 auto" }}>
          What you notice, who you think you are, and how that shapes the way you build. Start with a series or browse by topic.
        </p>
      </header>

      {series.map((s) => (
        <section key={s.id} className={styles.series} aria-labelledby={`series-${s.id}`}>
          <div className={styles.seriesHeader}>
            <h2 id={`series-${s.id}`} className={styles.seriesTitle}>{s.title}</h2>
            <p className={styles.seriesDescription}>{s.description}</p>
          </div>
          <ol className={styles.seriesRow}>
            {s.articles.map((a, i) => (
              <li key={a.slug}>
                <Link href={`/articles/${a.slug}/`} className={styles.card}>
                  <span className={styles.step}>{i === 0 ? "Start here" : `Part ${i + 1}`} · {a.readingMinutes} min</span>
                  <h3 className={styles.title}>{a.title}</h3>
                  {a.description && <p className={styles.description}>{a.description}</p>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {articles.length > 0 ? (
        <ArticleBrowser articles={articles} topics={topics} />
      ) : (
        <p style={{ textAlign: "center", color: "var(--ink-soft)" }}>Articles coming soon.</p>
      )}
    </div>
  );
}
