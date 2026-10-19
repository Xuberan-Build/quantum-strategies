import { supabaseAdmin } from "@/lib/supabase/server";
import { isPublicSlug } from "@/lib/seo/sitemap";
import { readingMinutes, topicSlug, type IndexArticle } from "@/lib/content/article-index";

/** Published blog posts from the DB, newest first, shaped for the index and related links. */
export async function getDbArticles(): Promise<IndexArticle[]> {
  const { data } = await supabaseAdmin
    .from("content_posts")
    .select("slug, title, excerpt, body, tags, published_at, content_pillars(title, slug)")
    .eq("is_published", true)
    .eq("type", "blog")
    .order("published_at", { ascending: false })
    .limit(200);

  return (data ?? []).filter((p) => isPublicSlug(p.slug)).map((p) => {
    const pillar = (Array.isArray(p.content_pillars) ? p.content_pillars[0] : p.content_pillars) as { title: string; slug: string } | null;
    const topic = pillar?.title ?? "More";
    return {
      slug: p.slug,
      title: p.title,
      description: p.excerpt ?? "",
      date: p.published_at ?? "",
      topic,
      topicSlug: topicSlug(topic),
      tags: p.tags ?? [],
      readingMinutes: readingMinutes(p.body ?? ""),
    };
  });
}
