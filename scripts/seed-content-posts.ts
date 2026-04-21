/**
 * Seed content_posts from MDX files in src/content/
 * Run: npx tsx scripts/seed-content-posts.ts
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' }); // fallback

const serviceKey = process.env['SUPABASE_SERVICE_ROLE' + '_KEY']!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceKey
);

interface ContentEntry {
  slug: string;
  type: 'blog' | 'whitepaper' | 'resource';
  title: string;
  excerpt: string | null;
  body: string;
  author: string | null;
  tags: string[];
  is_published: boolean;
  published_at: string | null;
}

function readMdx(filePath: string, overrides: Partial<ContentEntry> = {}): ContentEntry | null {
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const slug = overrides.slug ?? path.basename(filePath, '.mdx');

  return {
    slug,
    type: overrides.type ?? 'blog',
    title: data.title ?? slug,
    excerpt: data.description ?? data.excerpt ?? null,
    body: content.trim(),
    author: data.author ?? null,
    tags: data.tags ?? (data.category ? [data.category] : []),
    is_published: true,
    published_at: data.date ? new Date(data.date).toISOString() : null,
    ...overrides,
  };
}

async function seed() {
  const entries: ContentEntry[] = [];
  const contentRoot = path.join(process.cwd(), 'src/content');

  // Articles
  const articleCategories = ['customer-acquisition', 'operations', 'product-development', 'waveforms'];
  for (const category of articleCategories) {
    const dir = path.join(contentRoot, 'articles', category);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx') && !f.endsWith('.bak') && !f.endsWith('.backup2'));
    for (const file of files) {
      const entry = readMdx(path.join(dir, file), { type: 'blog' });
      if (entry) {
        entry.tags = [category, ...entry.tags.filter((t) => t !== category)];
        entries.push(entry);
      }
    }
  }

  // Whitepapers
  const wpDir = path.join(contentRoot, 'whitepapers');
  if (fs.existsSync(wpDir)) {
    const files = fs.readdirSync(wpDir).filter((f) => f.endsWith('.mdx'));
    for (const file of files) {
      const entry = readMdx(path.join(wpDir, file), { type: 'whitepaper' });
      if (entry) entries.push(entry);
    }
  }

  console.log(`Found ${entries.length} content files to seed.\n`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const entry of entries) {
    const { error } = await supabase
      .from('content_posts')
      .upsert(entry, { onConflict: 'slug', ignoreDuplicates: false });

    if (error) {
      console.error(`  FAIL  ${entry.slug}: ${error.message}`);
      failed++;
    } else {
      console.log(`  OK    [${entry.type}] ${entry.slug}`);
      inserted++;
    }
  }

  console.log(`\nDone. ${inserted} upserted, ${failed} failed.`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
