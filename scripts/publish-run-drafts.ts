/**
 * Publish content-pipeline run drafts (brain/content/pipeline/runs/<run>/draft.md) to content_posts.
 * Run: npx tsx scripts/publish-run-drafts.ts [--dry-run] [--tag series:x] <run-folder> [<run-folder> ...]
 *
 * Each draft needs YAML frontmatter: slug, title, meta_description, tags, pillar (content_pillars.title).
 * Refuses to publish a draft that still has placeholders, VERIFY markers, an over-long title,
 * a body that doesn't compile as MDX, or a link to the unlaunched /read/ flow.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' }); // fallback

const serviceKey = process.env['SUPABASE_SERVICE_ROLE' + '_KEY']!;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

const MAX_TITLE = 45; // the page appends " | Quantum Strategies"

type Prepared = {
  run: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  pillarTitle: string;
};

function cleanBody(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#\s+.+\n/m, '') // the page renders the title as the H1
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function prepare(runDir: string, extraTags: string[]): Promise<{ post?: Prepared; problems: string[] }> {
  const file = path.join(runDir, 'draft.md');
  const problems: string[] = [];
  if (!fs.existsSync(file)) return { problems: [`missing ${file}`] };

  const { data, content } = matter(fs.readFileSync(file, 'utf-8'));
  const body = cleanBody(content);
  const slug = String(data.slug ?? '').replace(/^\/?articles\//, '').replace(/\/$/, '');
  const title = String(data.title ?? '');
  const excerpt = String(data.meta_description ?? '');
  // Taxonomy tags from the brief, plus the keywords as plain public tags (used for Article JSON-LD keywords).
  const keywords = [data.primary_keyword, ...(Array.isArray(data.secondary_keywords) ? data.secondary_keywords : [])]
    .filter(Boolean)
    .map((k) => String(k).toLowerCase());
  const tags = [...new Set([...(Array.isArray(data.tags) ? data.tags.map(String) : []), ...keywords, ...extraTags])];
  const pillarTitle = String(data.pillar ?? '');

  if (!/^[a-z0-9-]+$/.test(slug)) problems.push(`bad slug "${slug}"`);
  if (!title || title.length > MAX_TITLE) problems.push(`title must be 1-${MAX_TITLE} chars (${title.length})`);
  if (excerpt.length < 120 || excerpt.length > 160) problems.push(`meta_description should be 120-160 chars (${excerpt.length})`);
  if (!pillarTitle) problems.push('no pillar');
  if (/\[AUSTIN/i.test(body)) problems.push('unresolved [AUSTIN] placeholder');
  if (/VERIFY/.test(body)) problems.push('VERIFY marker left in body');
  if (/\]\(\/read\//.test(body)) problems.push('links to /read/ (not launched)');
  if (!/^##\s+(frequently asked questions|faqs?)\b/im.test(body)) problems.push('no FAQ section');

  try {
    const { compile } = await import('@mdx-js/mdx'); // ESM-only
    await compile(body);
  } catch (err) {
    problems.push(`MDX compile failed: ${(err as Error).message}`);
  }

  return { post: { run: path.basename(runDir), slug, title, excerpt, body, tags, pillarTitle }, problems };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const extraTags = args.flatMap((a, i) => (args[i - 1] === '--tag' ? [a] : []));
  const runs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--tag');
  if (runs.length === 0) {
    console.error('Usage: npx tsx scripts/publish-run-drafts.ts [--dry-run] <run-folder> ...');
    process.exit(1);
  }

  const { data: pillars, error: pillarErr } = await supabase.from('content_pillars').select('id, title');
  if (pillarErr) throw pillarErr;

  const prepared: Prepared[] = [];
  let failed = false;
  for (const run of runs) {
    const { post, problems } = await prepare(run, extraTags);
    if (post && !pillars?.some((p) => p.title === post.pillarTitle)) problems.push(`unknown pillar "${post?.pillarTitle}"`);
    const words = post?.body.split(/\s+/).length ?? 0;
    console.log(`${problems.length ? '✗' : '✓'} ${path.basename(run)} → /articles/${post?.slug}/ (${words} words)`);
    problems.forEach((p) => console.log(`    - ${p}`));
    if (problems.length) failed = true;
    else if (post) prepared.push(post);
  }

  if (failed) {
    console.error('\nNothing published: fix the drafts above first.');
    process.exit(1);
  }
  if (dryRun) {
    console.log('\nDry run: all drafts pass. Nothing written.');
    return;
  }

  const now = new Date().toISOString();
  for (const p of prepared) {
    const { data: existing } = await supabase.from('content_posts').select('id, published_at').eq('slug', p.slug).maybeSingle();
    const row = {
      slug: p.slug,
      type: 'blog' as const,
      title: p.title,
      excerpt: p.excerpt,
      body: p.body,
      author: 'Austin Santos',
      tags: p.tags,
      pillar_id: pillars!.find((x) => x.title === p.pillarTitle)!.id,
      is_published: true,
      published_at: existing?.published_at ?? now,
    };
    const { error } = await supabase.from('content_posts').upsert(row, { onConflict: 'slug' });
    if (error) throw new Error(`${p.slug}: ${error.message}`);
    console.log(`published /articles/${p.slug}/${existing ? ' (updated)' : ''}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
