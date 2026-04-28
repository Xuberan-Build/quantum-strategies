import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import styles from "./pillar.module.css";

export const metadata = {
  title: "Content Pillars | Quantum Strategies",
  description: "Five strategic territories where consciousness meets business. Explore the bodies of work that define the Quantum Strategies framework.",
  alternates: {
    canonical: "https://quantumstrategies.online/pillars/",
  },
};

const TRADITION_COLORS: Record<string, string> = {
  taoism: "#10b981", kabbalah: "#8b5cf6", tantra: "#ef4444",
  sufism: "#f59e0b", christian_mysticism: "#3b82f6", hermeticism: "#a855f7",
  rosicrucianism: "#d97706", science: "#06b6d4", buddhism: "#f97316", hinduism: "#fb923c",
};

function traditionLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function PillarsPage() {
  const { data: pillars } = await supabaseAdmin
    .from("content_pillars")
    .select("id, slug, title, description, tradition_affinity")
    .order("created_at");

  const { data: topicCounts } = await supabaseAdmin
    .from("content_topics")
    .select("pillar_id");

  const { data: articleCounts } = await supabaseAdmin
    .from("content_posts")
    .select("pillar_id")
    .eq("is_published", true);

  const topicsByPillar = (topicCounts ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.pillar_id] = (acc[r.pillar_id] ?? 0) + 1;
    return acc;
  }, {});

  const articlesByPillar = (articleCounts ?? []).reduce<Record<string, number>>((acc, r) => {
    if (r.pillar_id) acc[r.pillar_id] = (acc[r.pillar_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.gridOverlay} />
        <div className={styles.glowOrb} />
        <div className={styles.heroInner}>
          <div className={styles.container}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              Framework
            </div>
            <h1 className={styles.heroTitle}>The Five Pillars</h1>
            <p className={styles.heroDesc}>
              Five strategic territories where mystical intelligence meets business architecture.
              Every piece of content, every product, every Rite lives inside one of these.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.pillarList}>
            {(pillars ?? []).map((pillar, i) => (
              <Link key={pillar.id} href={`/pillars/${pillar.slug}`} className={styles.pillarCard}>
                <div className={styles.pillarCardInner}>
                  <div className={styles.pillarCardLeft}>
                    <div className={styles.pillarNumber}>0{i + 1}</div>
                    <h2 className={styles.pillarCardTitle}>{pillar.title}</h2>
                    <p className={styles.pillarCardDesc}>{pillar.description}</p>
                    {(pillar.tradition_affinity ?? []).length > 0 && (
                      <div className={styles.traditions} style={{ marginTop: "1.25rem" }}>
                        {(pillar.tradition_affinity as string[]).map((t) => (
                          <span
                            key={t}
                            className={styles.traditionTag}
                            style={{
                              color: TRADITION_COLORS[t] ?? "#6b7280",
                              borderColor: TRADITION_COLORS[t] ?? "#6b7280",
                            }}
                          >
                            {traditionLabel(t)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.pillarCardMeta}>
                    {topicsByPillar[pillar.id] > 0 && (
                      <span className={styles.metaStat}>
                        {topicsByPillar[pillar.id]} topic{topicsByPillar[pillar.id] !== 1 ? "s" : ""}
                      </span>
                    )}
                    {articlesByPillar[pillar.id] > 0 && (
                      <span className={styles.metaStatAccent}>
                        {articlesByPillar[pillar.id]} article{articlesByPillar[pillar.id] !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className={styles.exploreLink}>Explore →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
