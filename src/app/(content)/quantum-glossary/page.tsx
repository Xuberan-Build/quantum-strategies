import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import styles from "./glossary.module.css";

type GlossaryEntry = {
  slug: string;
  title: string;
  description: string;
};

function getGlossaryEntries(): GlossaryEntry[] {
  const glossaryDir = path.join(process.cwd(), "src/content/glossary");
  if (!fs.existsSync(glossaryDir)) {
    return [];
  }

  const files = fs.readdirSync(glossaryDir).filter((file) => file.endsWith(".mdx"));
  return files.map((file) => {
    const filePath = path.join(glossaryDir, file);
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
  title: "Quantum Glossary | Quantum Strategies",
  description: "A living glossary connecting spiritual, quantum, and business concepts.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GlossaryPage() {
  const entries = getGlossaryEntries();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={`${styles.heroContent} container`}>
          <p className={styles.eyebrow}>Quantum Glossary</p>
          <h1 className={styles.title}>The Quantum Strategies Lexicon</h1>
          <p className={styles.subtitle}>
            A curated glossary linking mystical, spiritual, quantum, and business terminology.
            This hub will open publicly after the Waveforms series launches.
          </p>
        </div>
      </header>

      <section className={`${styles.section} container`}>
        {entries.length > 0 ? (
          <div className={styles.grid}>
            {entries.map((entry) => (
              <Link key={entry.slug} href={`/quantum-glossary/${entry.slug}/`} className={styles.card}>
                <h3 className={styles.cardTitle}>{entry.title}</h3>
                <p className={styles.cardDescription}>{entry.description}</p>
                <span className={styles.cardLink}>View term -&gt;</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h2>Glossary entries are in development.</h2>
            <p>We will publish this lexicon alongside the Waveforms series.</p>
          </div>
        )}
      </section>
    </div>
  );
}
