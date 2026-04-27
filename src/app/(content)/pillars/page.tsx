import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

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
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "4rem 1.25rem" }}>
      <header style={{ marginBottom: "3.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.875rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "0.75rem" }}>
          Framework
        </p>
        <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", color: "#fff", marginBottom: "1rem" }}>
          The Five Pillars
        </h1>
        <p style={{ fontSize: "1.2rem", color: "var(--ink-soft)", maxWidth: "640px", margin: "0 auto", lineHeight: 1.7 }}>
          Five strategic territories where mystical intelligence meets business architecture. Every piece of content, every product, every Rite lives inside one of these.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {(pillars ?? []).map((pillar, i) => (
          <Link
            key={pillar.id}
            href={`/pillars/${pillar.slug}`}
            style={{ display: "block", textDecoration: "none" }}
          >
            <div style={{
              padding: "2rem 2.5rem",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              transition: "all 0.2s",
            }}
              className="pillar-card"
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Pillar {i + 1}
                    </span>
                    {(pillar.tradition_affinity ?? []).map((t: string) => (
                      <span key={t} style={{
                        fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.08em", color: TRADITION_COLORS[t] ?? "#6b7280",
                        padding: "2px 8px", border: `1px solid ${TRADITION_COLORS[t] ?? "#6b7280"}`,
                        borderRadius: 4, opacity: 0.85,
                      }}>
                        {traditionLabel(t)}
                      </span>
                    ))}
                  </div>
                  <h2 style={{ fontSize: "1.625rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>
                    {pillar.title}
                  </h2>
                  <p style={{ color: "var(--ink-soft)", fontSize: "1rem", lineHeight: 1.7, maxWidth: "72ch" }}>
                    {pillar.description}
                  </p>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right", display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
                  {topicsByPillar[pillar.id] > 0 && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--ink-soft)" }}>
                      {topicsByPillar[pillar.id]} topic{topicsByPillar[pillar.id] !== 1 ? "s" : ""}
                    </span>
                  )}
                  {articlesByPillar[pillar.id] > 0 && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--accent)" }}>
                      {articlesByPillar[pillar.id]} article{articlesByPillar[pillar.id] !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span style={{ fontSize: "0.875rem", color: "var(--accent)", marginTop: "0.25rem" }}>
                    Explore →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
