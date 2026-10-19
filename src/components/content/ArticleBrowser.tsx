"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { IndexArticle } from "@/lib/content/article-index";
import styles from "./ArticleBrowser.module.css";

type Props = {
  articles: IndexArticle[];
  topics: { topic: string; slug: string; count: number }[];
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Every card is in the server HTML (crawlable); filtering only hides cards.
export default function ArticleBrowser({ articles, topics }: Props) {
  const [topic, setTopic] = useState("all");
  const [query, setQuery] = useState("");

  // Read ?topic= after mount so the page stays statically rendered.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("topic");
    if (t && topics.some((x) => x.slug === t)) setTopic(t);
  }, [topics]);

  const choose = (slug: string) => {
    setTopic(slug);
    const url = new URL(window.location.href);
    if (slug === "all") url.searchParams.delete("topic");
    else url.searchParams.set("topic", slug);
    window.history.replaceState(null, "", url.toString());
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter(
      (a) =>
        (topic === "all" || a.topicSlug === topic) &&
        (!q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)),
    );
  }, [articles, topic, query]);

  return (
    <section aria-labelledby="all-articles">
      <div className={styles.toolbar}>
        <h2 id="all-articles" className={styles.heading}>
          All articles <span className={styles.count}>{visible.length}</span>
        </h2>
        <input
          type="search"
          className={styles.search}
          placeholder="Search articles"
          aria-label="Search articles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.chips} role="group" aria-label="Filter by topic">
        <button
          type="button"
          className={`${styles.chip} ${topic === "all" ? styles.chipActive : ""}`}
          aria-pressed={topic === "all"}
          onClick={() => choose("all")}
        >
          All <span className={styles.chipCount}>{articles.length}</span>
        </button>
        {topics.map((t) => (
          <button
            key={t.slug}
            type="button"
            className={`${styles.chip} ${topic === t.slug ? styles.chipActive : ""}`}
            aria-pressed={topic === t.slug}
            onClick={() => choose(t.slug)}
          >
            {t.topic} <span className={styles.chipCount}>{t.count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty}>No articles match that. Try another topic or search.</p>
      ) : (
        <ul className={styles.grid}>
          {articles.map((a) => (
            <li key={a.slug} hidden={!visible.includes(a)}>
              <Link href={`/articles/${a.slug}/`} className={styles.card}>
                <span className={styles.topic}>{a.topic}</span>
                <h3 className={styles.title}>{a.title}</h3>
                {a.description && <p className={styles.description}>{a.description}</p>}
                <span className={styles.meta}>
                  {a.date && <time dateTime={a.date}>{formatDate(a.date)}</time>}
                  {a.date && " · "}
                  {a.readingMinutes} min read
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
