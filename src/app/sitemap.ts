import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

export const dynamic = "force-static";
export const revalidate = false;

const base = "https://quantumstrategies.online";
const contentRoot = path.join(process.cwd(), "src/content");

function getMdxEntries(dir: string, urlPrefix: string): MetadataRoute.Sitemap {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mdx") && !file.startsWith("_"))
    .map((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const slug = file.replace(".mdx", "");
      return {
        url: `${base}${urlPrefix}/${slug}/`,
        lastModified: stat.mtime,
        changeFrequency: "monthly",
        priority: 0.6,
      };
    });
}

function getArticleEntries(): MetadataRoute.Sitemap {
  const categories = ["customer-acquisition", "operations", "product-development", "waveforms"];
  const entries: MetadataRoute.Sitemap = [];

  categories.forEach((category) => {
    const dir = path.join(contentRoot, "articles", category);
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".mdx") && !file.startsWith("_"));

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const slug = file.replace(".mdx", "");
      entries.push({
        url: `${base}/articles/${slug}/`,
        lastModified: stat.mtime,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    });
  });

  return entries;
}

function getProductEntries(): MetadataRoute.Sitemap {
  const productsDir = path.join(process.cwd(), "src/app/(content)/products");
  if (!fs.existsSync(productsDir)) {
    return [];
  }

  const excludedSlugs = new Set(["beta"]);

  return fs
    .readdirSync(productsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !excludedSlugs.has(entry.name))
    .map((entry) => ({
      url: `${base}/products/${entry.name}/`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/meet/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/values/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/resources/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/articles/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/articles/customer-acquisition/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/articles/operations/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/articles/product-development/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/articles/waveforms/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/the-rite-system/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/courses/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/courses/vcap/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/whitepapers/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/portfolio/`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy/`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms/`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  const articles = getArticleEntries();
  const whitepapers = getMdxEntries(path.join(contentRoot, "whitepapers"), "/whitepapers");
  const products = getProductEntries();

  // Note: Glossary entries excluded from sitemap - they have noindex directives
  return [...staticRoutes, ...articles, ...whitepapers, ...products];
}
