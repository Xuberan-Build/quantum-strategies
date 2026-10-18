import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import styles from "../pillar.module.css";

type Article = {
  slug: string;
  title: string;
  description: string;
};

function getArticles(): Article[] {
  const categoryDir = path.join(process.cwd(), "src/content/articles/operations");
  if (!fs.existsSync(categoryDir)) {
    return [];
  }

  return fs
    .readdirSync(categoryDir)
    .filter((file) => file.endsWith(".mdx") && !file.startsWith("_"))
    .map((file) => {
      const filePath = path.join(categoryDir, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(fileContent);

      return {
        slug: file.replace(".mdx", ""),
        title: data.title || file.replace(".mdx", ""),
        description: data.description || "",
      };
    });
}

export const metadata = {
  title: "Operations | Quantum Strategies",
  description:
    "Operational systems that keep acquisition, delivery, and retention running at scale.",
  alternates: { canonical: "https://quantumstrategies.online/articles/operations/" },
};

export default function OperationsHub() {
  const articles = getArticles();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={`${styles.heroContent} container`}>
          <h1 className={styles.title}>Operations</h1>
          <p className={styles.subtitle}>
            Build the infrastructure that keeps growth stable: automation, CRM, and repeatable
            delivery.
          </p>
        </div>
      </header>

      <section className={`${styles.section} container`}>
        <div className={styles.sectionHeader}>
          <h2>Explore the Cluster</h2>
          <p>Systems, tooling, and process design for sustainable execution.</p>
        </div>

        <div className={styles.grid}>
          {articles.map((article) => (
            <Link key={article.slug} href={`/articles/${article.slug}/`} className={styles.card}>
              <h3 className={styles.cardTitle}>{article.title}</h3>
              <p className={styles.cardDescription}>{article.description}</p>
              <span className={styles.cardMeta}>Read article -&gt;</span>
            </Link>
          ))}
        </div>

        <div className={styles.ctaRow}>
          <Link href="/whitepapers/" className={styles.ctaButton}>
            Download white papers -&gt;
          </Link>
          <Link href="/courses/vcap/" className={styles.ctaButton}>
            Explore VCAP -&gt;
          </Link>
        </div>
      </section>
    </div>
  );
}
