import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import styles from "./whitepapers.module.css";

interface Whitepaper {
  slug: string;
  title: string;
  description: string;
  date: string;
  author?: string;
}

function getAllWhitepapers(): Whitepaper[] {
  const whitepapersDir = path.join(process.cwd(), "src/content/whitepapers");
  if (!fs.existsSync(whitepapersDir)) {
    return [];
  }

  const files = fs.readdirSync(whitepapersDir).filter((file) => file.endsWith(".mdx"));
  const whitepapers: Whitepaper[] = files.map((file) => {
    const filePath = path.join(whitepapersDir, file);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(fileContent);

    return {
      slug: file.replace(".mdx", ""),
      title: data.title || file.replace(".mdx", ""),
      description: data.description || "",
      date: data.date || "",
      author: data.author || "",
    };
  });

  return whitepapers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const metadata = {
  title: "White Papers | Quantum Strategies",
  description:
    "Deep research and strategic frameworks that connect consciousness, commerce, and measurable growth.",
  alternates: {
    canonical: "https://quantumstrategies.online/whitepapers/",
  },
};

export default function WhitepapersPage() {
  const whitepapers = getAllWhitepapers();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={`${styles.heroContent} container`}>
          <p className={styles.eyebrow}>White Papers</p>
          <h1 className={styles.title}>Strategic Research for Conscious Growth</h1>
          <p className={styles.subtitle}>
            Long-form research, market analysis, and frameworks you can apply immediately.
          </p>
        </div>
      </section>

      <section className={`${styles.gridSection} container`}>
        {whitepapers.length > 0 ? (
          <div className={styles.grid}>
            {whitepapers.map((paper) => (
              <Link key={paper.slug} href={`/whitepapers/${paper.slug}/`} className={styles.card}>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>White Paper</span>
                  {paper.date && (
                    <time className={styles.cardDate}>
                      {new Date(paper.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  )}
                </div>
                <h3 className={styles.cardTitle}>{paper.title}</h3>
                <p className={styles.cardDescription}>{paper.description}</p>
                <span className={styles.cardLink}>Read the paper -&gt;</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h2>No white papers published yet.</h2>
            <p>New research drops soon. Check back or reach out for early access.</p>
            <a className={styles.emptyCta} href="mailto:austin.j.santos.93@gmail.com">
              Request early access -&gt;
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
