import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import styles from "./waveforms.module.css";

type Episode = {
  slug: string;
  title: string;
  description: string;
  episode: number;
};

function getEpisodes(): Episode[] {
  const seriesDir = path.join(process.cwd(), "src/content/articles/waveforms");
  if (!fs.existsSync(seriesDir)) {
    return [];
  }

  const files = fs.readdirSync(seriesDir).filter((file) => file.endsWith(".mdx"));
  return files
    .map((file) => {
      const filePath = path.join(seriesDir, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(fileContent);
      return {
        slug: file.replace(".mdx", ""),
        title: data.title || file.replace(".mdx", ""),
        description: data.description || "",
        episode: data.episode || 0,
      };
    })
    .sort((a, b) => a.episode - b.episode);
}

export const metadata = {
  title: "The Waveforms Series | Quantum Strategies",
  description:
    "A 12-part series exploring how values become patterns, patterns become systems, and systems become reality.",
  alternates: { canonical: "https://quantumstrategies.online/articles/waveforms/" },
};

export default function WaveformsHub() {
  const episodes = getEpisodes();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={`${styles.heroContent} container`}>
          <p className={styles.eyebrow}>Series</p>
          <h1 className={styles.title}>The Waveforms Series</h1>
          <p className={styles.subtitle}>
            How values become patterns, patterns become systems, and systems become reality.
          </p>
          <div className={styles.coreSpine}>
            <p>A waveform is a system of values changing over time.</p>
            <p>What we value determines what we amplify.</p>
            <p>What we amplify becomes our experience.</p>
          </div>
        </div>
      </header>

      <section className={`${styles.section} container`}>
        <div className={styles.sectionHeader}>
          <h2>Episodes</h2>
          <p>Each episode pairs a physics concept with a value principle and a product tie-in.</p>
        </div>

        <div className={styles.grid}>
          {episodes.map((episode) => (
            <Link
              key={episode.slug}
              href={`/articles/${episode.slug}/`}
              className={styles.card}
            >
              <span className={styles.cardEyebrow}>Episode {episode.episode}</span>
              <h3 className={styles.cardTitle}>{episode.title}</h3>
              <p className={styles.cardDescription}>{episode.description}</p>
              <span className={styles.cardLink}>Read episode -&gt;</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
