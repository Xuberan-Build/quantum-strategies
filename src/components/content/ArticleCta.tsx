import Link from "next/link";
import { isReadLive } from "@/lib/read/live";
import styles from "./ArticleCta.module.css";

// One call to action after every article: the free Perception Read once it's
// switched on, the free beta until then. Flipping is_active is the only switch.
export default async function ArticleCta({ slug }: { slug: string }) {
  const readLive = await isReadLive();

  const utm = new URLSearchParams({
    utm_source: "article",
    utm_campaign: "article-cta",
    utm_content: readLive ? "read" : "beta",
    utm_term: slug,
  }).toString();

  return readLive ? (
    <aside className={styles.cta} aria-label="Take the Perception Read">
      <p className={styles.eyebrow}>Free · about 5 minutes</p>
      <h2 className={styles.title}>See what your attention is set to</h2>
      <p className={styles.body}>
        Twelve questions about what you did and said this month. The Perception Read shows the pattern your answers
        keep repeating. It's a reflection tool, not a diagnosis.
      </p>
      <Link href={`/read/?${utm}`} className={`${styles.button} ${styles.readButton}`}>
        Take the free Read →
      </Link>
    </aside>
  ) : (
    <aside className={styles.cta} aria-label="Join the free beta">
      <p className={styles.eyebrow}>Free beta</p>
      <h2 className={styles.title}>Try the Quantum Strategies tools</h2>
      <p className={styles.body}>
        The beta is open. You get free access to the QS tools, and in return you tell us what helped and what
        didn&apos;t.
      </p>
      <Link href={`/products/beta/?${utm}`} className={styles.button}>
        Join the free beta →
      </Link>
    </aside>
  );
}
