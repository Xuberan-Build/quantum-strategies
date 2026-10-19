import Link from "next/link";
import { getDbArticles } from "@/lib/content/article-list";
import { buildSeries } from "@/lib/content/article-index";
import styles from "@/components/content/ArticleBrowser.module.css";

// Server-rendered so crawlers reach the articles straight from the homepage.
export default async function HomeReading() {
  const articles = await getDbArticles();
  const series = buildSeries(articles)[0];
  const seriesSlugs = new Set(series?.articles.map((a) => a.slug));
  const latest = articles.filter((a) => !seriesSlugs.has(a.slug)).slice(0, 3);

  if (!series && latest.length === 0) return null;

  return (
    <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "4rem 1rem" }}>
      {series && (
        <section className={styles.series} aria-labelledby="home-series">
          <div className={styles.seriesHeader}>
            <h2 id="home-series" className={styles.seriesTitle}>
              Start here: {series.title}
            </h2>
            <p className={styles.seriesDescription}>{series.description}</p>
          </div>
          <ol className={styles.seriesRow}>
            {series.articles.map((a, i) => (
              <li key={a.slug}>
                <Link href={`/articles/${a.slug}/`} className={styles.card}>
                  <span className={styles.step}>Part {i + 1} · {a.readingMinutes} min</span>
                  <h3 className={styles.title}>{a.title}</h3>
                  {a.description && <p className={styles.description}>{a.description}</p>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {latest.length > 0 && (
        <section aria-labelledby="home-latest">
          <div className={styles.toolbar}>
            <h2 id="home-latest" className={styles.heading}>Latest articles</h2>
            <Link href="/articles/" className={styles.chip}>Browse all articles →</Link>
          </div>
          <ul className={styles.grid}>
            {latest.map((a) => (
              <li key={a.slug}>
                <Link href={`/articles/${a.slug}/`} className={styles.card}>
                  <span className={styles.topic}>{a.topic}</span>
                  <h3 className={styles.title}>{a.title}</h3>
                  {a.description && <p className={styles.description}>{a.description}</p>}
                  <span className={styles.meta}>{a.readingMinutes} min read</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
