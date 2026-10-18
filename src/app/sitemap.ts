import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildSitemap, type DatedSlug } from "@/lib/seo/sitemap";

// Static, refreshed hourly and on demand: the studio publish route calls
// revalidatePath("/sitemap.xml") so new DB posts appear without a redeploy.
export const revalidate = 3600;

const contentRoot = path.join(process.cwd(), "src/content");
const ARTICLE_CATEGORIES = ["customer-acquisition", "operations", "product-development", "waveforms"];

/**
 * MDX files in a folder, dated by frontmatter (`updated` / `lastModified`, else
 * `date`). File mtimes are not used: on Vercel every file has the clone time.
 */
function readMdxDir(dir: string): DatedSlug[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mdx"))
    .flatMap((file): DatedSlug[] => {
      const { data } = matter(fs.readFileSync(path.join(dir, file), "utf-8"));
      if (data.draft === true || data.published === false) return [];
      return [
        {
          slug: file.replace(/\.mdx$/, ""),
          lastModified: (data.updated ?? data.lastModified ?? data.date ?? null) as string | null,
        },
      ];
    });
}

function getStaticProductSlugs(): string[] {
  const productsDir = path.join(process.cwd(), "src/app/(content)/products");
  if (!fs.existsSync(productsDir)) return [];
  return fs
    .readdirSync(productsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(productsDir, e.name, "page.tsx")))
    .map((e) => e.name);
}

async function safeQuery<T>(label: string, run: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error(`[sitemap] could not load ${label}`, err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [dbPosts, pillars] = await Promise.all([
    safeQuery<{ slug: string; updated_at: string | null; published_at: string | null }>("DB articles", () =>
      supabaseAdmin
        .from("content_posts")
        .select("slug, updated_at, published_at")
        .eq("is_published", true)
        .eq("type", "blog"),
    ),
    safeQuery<{ slug: string; updated_at: string | null; created_at: string | null }>("pillars", () =>
      supabaseAdmin.from("content_pillars").select("slug, updated_at, created_at"),
    ),
  ]);

  return buildSitemap({
    dbArticles: dbPosts.map((p) => ({ slug: p.slug, lastModified: p.updated_at ?? p.published_at })),
    mdxArticles: ARTICLE_CATEGORIES.flatMap((c) => readMdxDir(path.join(contentRoot, "articles", c))),
    whitepapers: readMdxDir(path.join(contentRoot, "whitepapers")),
    pillars: pillars.map((p) => ({ slug: p.slug, lastModified: p.updated_at ?? p.created_at })),
    staticProductSlugs: getStaticProductSlugs(),
    // DB landing pages (product_landing_pages) are not listed yet: /products/[slug]
    // filters on a `product_slug` column the table does not have (it is `slug`),
    // so it can never render one. Wire them in here once that route is fixed:
    // select("slug, updated_at").eq("status", "published").
    dbProductPages: [],
  });
}
