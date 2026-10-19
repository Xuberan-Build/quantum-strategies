/**
 * Update existing content_posts rows from edited markdown files (one per post, named <slug>.md).
 * Run: npx tsx scripts/update-posts-from-files.ts [--dry-run] <file.md> [<file.md> ...]
 *
 * Frontmatter: title, excerpt, optional primary_keyword / secondary_keywords (added as plain tags).
 * Only title, excerpt, body and tags change; slug, pillar and published_at stay as they are.
 * Refuses files with em dashes, an over-long title, or a body that doesn't compile as MDX.
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

async function check(file: string) {
  const problems: string[] = [];
  const slug = path.basename(file, '.md');
  const { data, content } = matter(fs.readFileSync(file, 'utf-8'));
  const title = String(data.title ?? '');
  const excerpt = String(data.excerpt ?? '');
  const body = content.replace(/^#\s+.+\n/m, '').trim(); // the page renders the title as the H1
  const keywords = [data.primary_keyword, ...(Array.isArray(data.secondary_keywords) ? data.secondary_keywords : [])]
    .filter(Boolean)
    .map((k) => String(k).toLowerCase());

  if (!title || title.length > MAX_TITLE) problems.push(`title must be 1-${MAX_TITLE} chars (${title.length})`);
  if (excerpt.length < 120 || excerpt.length > 160) problems.push(`excerpt should be 120-160 chars (${excerpt.length})`);
  if (/[—]| – /.test(title + excerpt + body)) problems.push('em dash or spaced en dash left');
  if (/^---\s*$/m.test(body) && /^title:/m.test(body)) problems.push('stray frontmatter block inside the body');
  try {
    const { compile } = await import('@mdx-js/mdx'); // ESM-only
    await compile(body.replace(/<!--[\s\S]*?-->/g, ''));
  } catch (err) {
    problems.push(`MDX compile failed: ${(err as Error).message}`);
  }
  return { slug, title, excerpt, body, keywords, problems };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length === 0) {
    console.error('Usage: npx tsx scripts/update-posts-from-files.ts [--dry-run] <file.md> ...');
    process.exit(1);
  }

  const checked = await Promise.all(files.map(check));
  let failed = false;
  for (const c of checked) {
    const { data: row } = await supabase.from('content_posts').select('id').eq('slug', c.slug).maybeSingle();
    if (!row) c.problems.push('no content_posts row with this slug');
    console.log(`${c.problems.length ? '✗' : '✓'} ${c.slug} (${c.title.length} char title, ${c.body.split(/\s+/).length} words)`);
    c.problems.forEach((p) => console.log(`    - ${p}`));
    if (c.problems.length) failed = true;
  }
  if (failed) {
    console.error('\nNothing updated: fix the files above first.');
    process.exit(1);
  }
  if (dryRun) {
    console.log('\nDry run: all files pass. Nothing written.');
    return;
  }

  for (const c of checked) {
    const { data: row } = await supabase.from('content_posts').select('tags').eq('slug', c.slug).single();
    const tags = [...new Set([...((row?.tags as string[] | null) ?? []), ...c.keywords])];
    const body = c.body.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n');
    const { error } = await supabase
      .from('content_posts')
      .update({ title: c.title, excerpt: c.excerpt, body, tags })
      .eq('slug', c.slug);
    if (error) throw new Error(`${c.slug}: ${error.message}`);
    console.log(`updated /articles/${c.slug}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
