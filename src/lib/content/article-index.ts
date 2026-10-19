/**
 * Shape the /articles/ index: merge DB posts and MDX files (DB wins on slug),
 * assign each a topic, and group named series.
 */

export type IndexArticle = {
  slug: string;
  title: string;
  description: string;
  date: string;
  topic: string;
  topicSlug: string;
  tags: string[];
  readingMinutes: number;
};

export type Series = {
  id: string;
  title: string;
  description: string;
  articles: IndexArticle[];
};

// MDX folders predate pillars; map them onto the pillar names readers see.
export const MDX_FOLDER_TOPICS: Record<string, string> = {
  "customer-acquisition": "Growth & Marketing",
  operations: "Business Strategy",
  "product-development": "Business Strategy",
  waveforms: "Mindset & Worldview",
};

export function topicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function readingMinutes(body: string): number {
  const words = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

export function mergeArticles(db: IndexArticle[], mdx: IndexArticle[]): IndexArticle[] {
  const seen = new Set(db.map((a) => a.slug));
  return [...db, ...mdx.filter((a) => !seen.has(a.slug))].sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
  );
}

export function topicCounts(articles: IndexArticle[]): { topic: string; slug: string; count: number }[] {
  const counts = new Map<string, number>();
  articles.forEach((a) => counts.set(a.topic, (counts.get(a.topic) ?? 0) + 1));
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, slug: topicSlug(topic), count }))
    .sort((a, b) => b.count - a.count);
}

const SERIES_DEFS: { id: string; title: string; description: string; match: (a: IndexArticle) => boolean; order?: string[] }[] = [
  {
    id: "attention-and-perception",
    title: "Attention & perception",
    description: "What your brain is set to notice, why you see it everywhere, and how to change the set on purpose.",
    match: (a) => a.tags.includes("series:attention-and-perception"),
    order: [
      "reticular-activating-system",
      "selective-attention",
      "baader-meinhof-phenomenon",
      "confirmation-bias",
      "self-image",
      "manifestation-vision-board",
    ],
  },
  {
    id: "waveforms",
    title: "The Waveforms series",
    description: "A 12-part series on how values become patterns, patterns become systems, and systems become reality.",
    match: (a) => /^episode-\d+/.test(a.slug),
  },
];

export function buildSeries(articles: IndexArticle[]): Series[] {
  return SERIES_DEFS.map((def) => {
    const members = articles.filter(def.match);
    const rank = (a: IndexArticle) => {
      if (def.order) {
        const i = def.order.indexOf(a.slug);
        return i === -1 ? def.order.length : i;
      }
      return Number(a.slug.match(/^episode-(\d+)/)?.[1] ?? 0);
    };
    return { id: def.id, title: def.title, description: def.description, articles: [...members].sort((a, b) => rank(a) - rank(b)) };
  }).filter((s) => s.articles.length > 0);
}
