import { describe, it, expect } from "vitest";
import {
  SITE_URL,
  STATIC_PAGES,
  buildSitemap,
  isPublicSlug,
  isValidSitemapUrl,
  type SitemapInput,
} from "../sitemap";

const input: SitemapInput = {
  dbArticles: [
    { slug: "your-brand-is-leaking", lastModified: "2026-09-01T10:00:00Z" },
    { slug: "complete-guide", lastModified: "2026-08-01T00:00:00Z" },
    { slug: "_pillar", lastModified: "2026-08-02T00:00:00Z" },
  ],
  mdxArticles: [
    { slug: "complete-guide", lastModified: "2025-01-15" },
    { slug: "mvp-strategy", lastModified: "2026-04-27" },
    { slug: "_pillar", lastModified: "2025-01-15" },
    { slug: "no-date" },
  ],
  whitepapers: [{ slug: "the-pattern-problem-astrology", lastModified: "2026-02-27" }],
  pillars: [{ slug: "the-self-as-signal", lastModified: "2026-05-01T00:00:00Z" }, { slug: "_draft" }],
  staticProductSlugs: ["[slug]", "beta", "perception", "_template", "personal-alignment"],
  dbProductPages: [
    { slug: "perception", lastModified: "2026-06-01T00:00:00Z" },
    { slug: "new-offer", lastModified: "2026-07-01T00:00:00Z" },
  ],
};

describe("buildSitemap", () => {
  const sitemap = buildSitemap(input);
  const urls = sitemap.map((e) => e.url);

  it("never contains a route placeholder", () => {
    expect(urls.some((u) => u.includes("["))).toBe(false);
  });

  it("never contains an internal _ path", () => {
    expect(urls.some((u) => u.slice(SITE_URL.length).includes("/_"))).toBe(false);
  });

  it("ends every URL with a trailing slash", () => {
    expect(urls.every((u) => u.endsWith("/"))).toBe(true);
  });

  it("has no duplicate URLs and every URL passes validation", () => {
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every(isValidSitemapUrl)).toBe(true);
  });

  it("includes the indexable static pages linked from nav and footer", () => {
    for (const path of ["/", "/meet/", "/values/", "/pillars/", "/courses/", "/portfolio/", "/resources/", "/articles/", "/whitepapers/"]) {
      expect(urls).toContain(`${SITE_URL}${path}`);
    }
  });

  it("excludes beta and noindex pages", () => {
    expect(urls).not.toContain(`${SITE_URL}/products/beta/`);
    expect(urls.some((u) => u.includes("/quantum-glossary"))).toBe(false);
  });

  it("prefers the DB date over the MDX date for the same article", () => {
    const e = sitemap.find((x) => x.url === `${SITE_URL}/articles/complete-guide/`);
    expect(e?.lastModified).toEqual(new Date("2026-08-01T00:00:00Z"));
  });

  it("omits lastModified when the date is unknown instead of using now", () => {
    const e = sitemap.find((x) => x.url === `${SITE_URL}/articles/no-date/`);
    expect(e).toBeDefined();
    expect(e?.lastModified).toBeUndefined();
  });

  it("dates listing pages by their newest item", () => {
    const articles = sitemap.find((x) => x.url === `${SITE_URL}/articles/`);
    expect(articles?.lastModified).toEqual(new Date("2026-09-01T10:00:00Z"));
    const wp = sitemap.find((x) => x.url === `${SITE_URL}/whitepapers/`);
    expect(wp?.lastModified).toEqual(new Date("2026-02-27"));
  });

  it("does not stamp any entry with the current time", () => {
    const now = Date.now();
    for (const e of sitemap) {
      if (e.lastModified) expect(Math.abs(new Date(e.lastModified).getTime() - now)).toBeGreaterThan(60_000);
    }
  });

  it("adds published DB product pages once, after static product folders", () => {
    expect(urls.filter((u) => u === `${SITE_URL}/products/perception/`)).toHaveLength(1);
    expect(urls).toContain(`${SITE_URL}/products/new-offer/`);
  });

  it("static page list itself is valid", () => {
    for (const p of STATIC_PAGES) expect(isValidSitemapUrl(`${SITE_URL}${p.path}`)).toBe(true);
  });
});

describe("isPublicSlug / isValidSitemapUrl", () => {
  it("rejects templates, placeholders and empty slugs", () => {
    expect(isPublicSlug("_pillar")).toBe(false);
    expect(isPublicSlug("[slug]")).toBe(false);
    expect(isPublicSlug("")).toBe(false);
    expect(isPublicSlug(null)).toBe(false);
    expect(isPublicSlug("mvp-strategy")).toBe(true);
  });

  it("rejects off-site, slashless, placeholder and underscore URLs", () => {
    expect(isValidSitemapUrl("https://example.com/a/")).toBe(false);
    expect(isValidSitemapUrl(`${SITE_URL}/meet`)).toBe(false);
    expect(isValidSitemapUrl(`${SITE_URL}/products/[slug]/`)).toBe(false);
    expect(isValidSitemapUrl(`${SITE_URL}/articles/_pillar/`)).toBe(false);
    expect(isValidSitemapUrl(`${SITE_URL}/meet/`)).toBe(true);
  });
});
