import type { MetadataRoute } from "next";

/**
 * Pure sitemap assembly. src/app/sitemap.ts gathers the raw inputs (DB rows,
 * MDX frontmatter, route folders) and hands them here, so the URL rules can be
 * unit-tested without a database or filesystem.
 *
 * Rules:
 *  - every URL is absolute, on SITE_URL, and ends with "/" (trailingSlash: true)
 *  - no dynamic-route placeholders ("[slug]") and no internal "_" segments
 *  - lastModified is a real content date or omitted, never "now"
 */

export const SITE_URL = "https://quantumstrategies.online";

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
export type SitemapEntry = MetadataRoute.Sitemap[number];

type StaticPage = {
  path: string;
  /** Date the page's content last changed. Bump it when you edit the page. */
  lastModified?: string;
  changeFrequency: ChangeFrequency;
  priority: number;
};

/**
 * Indexable static pages. lastModified is the date of the last commit that
 * changed the page (git log), not build time; bump it when the page changes.
 * /articles/ and /whitepapers/ take the newest date of the items they list.
 *
 * Left out on purpose:
 *  - /quantum-glossary/** and /beta/ (noindex)
 *  - /terms/, /privacy/ (legal boilerplate; crawlable from the footer)
 *  - /unsubscribe/, auth, dashboard, admin, ledger, onboarding (not public content)
 *  - /articles/<category>/ stubs (thin MDX-only listings superseded by /pillars/)
 */
export const STATIC_PAGES: StaticPage[] = [
  { path: "/", lastModified: "2026-04-27", changeFrequency: "weekly", priority: 1 },
  { path: "/the-rite-system/", lastModified: "2026-04-28", changeFrequency: "monthly", priority: 0.9 },
  { path: "/meet/", lastModified: "2026-05-07", changeFrequency: "monthly", priority: 0.7 },
  { path: "/values/", lastModified: "2026-01-22", changeFrequency: "monthly", priority: 0.5 },
  { path: "/articles/", changeFrequency: "weekly", priority: 0.8 },
  { path: "/pillars/", lastModified: "2026-04-28", changeFrequency: "weekly", priority: 0.8 },
  { path: "/whitepapers/", changeFrequency: "monthly", priority: 0.7 },
  { path: "/courses/", lastModified: "2026-01-26", changeFrequency: "monthly", priority: 0.5 },
  { path: "/courses/vcap/", lastModified: "2026-01-26", changeFrequency: "monthly", priority: 0.5 },
  { path: "/portfolio/", lastModified: "2026-01-26", changeFrequency: "monthly", priority: 0.5 },
  { path: "/resources/", lastModified: "2026-01-26", changeFrequency: "monthly", priority: 0.5 },
];

/** Static product landing pages: last content change per folder (git log). */
export const PRODUCT_PAGE_LAST_MODIFIED: Record<string, string> = {
  "brand-alignment": "2026-04-21",
  "business-alignment": "2026-04-21",
  declaration: "2026-04-21",
  "declaration-rite-business-model": "2026-04-21",
  "declaration-rite-life-vision": "2026-04-21",
  "declaration-rite-strategic-path": "2026-04-21",
  orientation: "2026-04-21",
  perception: "2026-04-21",
  "perception-rite-scan-1": "2026-04-21",
  "perception-rite-scan-2": "2026-04-21",
  "perception-rite-scan-3": "2026-04-21",
  "perception-rite-scan-4": "2026-04-21",
  "perception-rite-scan-5": "2026-04-21",
  "personal-alignment": "2026-04-21",
};

/** Product folders that exist but are not public landing pages. */
export const EXCLUDED_PRODUCT_SLUGS = new Set(["beta"]);

/**
 * Slugs that must never be public: "_"-prefixed files are templates/drafts
 * (e.g. the old `_pillar` template that was seeded into content_posts), and
 * bracketed names are route placeholders, not pages.
 */
export function isPublicSlug(slug: string | null | undefined): slug is string {
  if (!slug) return false;
  if (slug.startsWith("_")) return false;
  if (/[[\]/?#\s]/.test(slug)) return false;
  return true;
}

export function absoluteUrl(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  if (!p.endsWith("/")) p = `${p}/`;
  return `${SITE_URL}${p}`;
}

/** A URL the sitemap may contain: on-site, trailing slash, no placeholder or internal segment. */
export function isValidSitemapUrl(url: string): boolean {
  if (!url.startsWith(`${SITE_URL}/`)) return false;
  if (!url.endsWith("/")) return false;
  if (url.includes("[") || url.includes("]")) return false;
  const path = url.slice(SITE_URL.length);
  if (path.split("/").some((seg) => seg.startsWith("_"))) return false;
  if (/[?#\s]/.test(path)) return false;
  return true;
}

/** Parse a date-ish value; returns undefined for missing or invalid input. */
export function toDate(value: string | Date | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function newest(dates: Array<Date | undefined>): Date | undefined {
  let max: Date | undefined;
  for (const d of dates) if (d && (!max || d > max)) max = d;
  return max;
}

export type DatedSlug = { slug: string; lastModified?: string | Date | null };

export type SitemapInput = {
  /** Published content_posts (type blog), served at /articles/[slug]/. */
  dbArticles: DatedSlug[];
  /** MDX articles (src/content/articles/<category>/*.mdx). DB wins on slug clash. */
  mdxArticles: DatedSlug[];
  /** MDX whitepapers (src/content/whitepapers/*.mdx). */
  whitepapers: DatedSlug[];
  /** content_pillars rows, served at /pillars/[slug]/. */
  pillars: DatedSlug[];
  /** Folder names under src/app/(content)/products that contain a page.tsx. */
  staticProductSlugs: string[];
  /** Published product_landing_pages served by /products/[slug]/. */
  dbProductPages: DatedSlug[];
};

function entry(
  path: string,
  lastModified: Date | undefined,
  changeFrequency: ChangeFrequency,
  priority: number,
): SitemapEntry {
  return {
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  };
}

export function buildSitemap(input: SitemapInput): MetadataRoute.Sitemap {
  // Articles: DB posts first (most were seeded from MDX), then MDX not in DB.
  const articleDates = new Map<string, Date | undefined>();
  for (const a of input.dbArticles) {
    if (isPublicSlug(a.slug) && !articleDates.has(a.slug)) articleDates.set(a.slug, toDate(a.lastModified));
  }
  for (const a of input.mdxArticles) {
    if (isPublicSlug(a.slug) && !articleDates.has(a.slug)) articleDates.set(a.slug, toDate(a.lastModified));
  }
  const articles = [...articleDates].map(([slug, d]) => entry(`/articles/${slug}/`, d, "monthly", 0.7));

  const whitepaperDates = input.whitepapers
    .filter((w) => isPublicSlug(w.slug))
    .map((w) => ({ slug: w.slug, d: toDate(w.lastModified) }));
  const whitepapers = whitepaperDates.map(({ slug, d }) => entry(`/whitepapers/${slug}/`, d, "monthly", 0.7));

  const pillars = input.pillars
    .filter((p) => isPublicSlug(p.slug))
    .map((p) => entry(`/pillars/${p.slug}/`, toDate(p.lastModified), "weekly", 0.7));

  const productSlugs = new Set<string>();
  const products: SitemapEntry[] = [];
  for (const slug of input.staticProductSlugs) {
    if (!isPublicSlug(slug) || EXCLUDED_PRODUCT_SLUGS.has(slug) || productSlugs.has(slug)) continue;
    productSlugs.add(slug);
    products.push(entry(`/products/${slug}/`, toDate(PRODUCT_PAGE_LAST_MODIFIED[slug]), "monthly", 0.6));
  }
  for (const p of input.dbProductPages) {
    if (!isPublicSlug(p.slug) || EXCLUDED_PRODUCT_SLUGS.has(p.slug) || productSlugs.has(p.slug)) continue;
    productSlugs.add(p.slug);
    products.push(entry(`/products/${p.slug}/`, toDate(p.lastModified), "monthly", 0.6));
  }

  const listingDates: Record<string, Date | undefined> = {
    "/articles/": newest([...articleDates.values()]),
    "/whitepapers/": newest(whitepaperDates.map((w) => w.d)),
  };
  const statics = STATIC_PAGES.map((p) =>
    entry(p.path, toDate(p.lastModified) ?? listingDates[p.path], p.changeFrequency, p.priority),
  );

  const seen = new Set<string>();
  return [...statics, ...pillars, ...articles, ...whitepapers, ...products].filter((e) => {
    if (!isValidSitemapUrl(e.url) || seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}
