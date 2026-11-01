#!/usr/bin/env tsx
/**
 * Import derivative pieces (distilled from live articles) into content_pieces for the content calendar.
 *
 *   npx tsx scripts/content/import-derivatives.ts            # dry run: validate and print counts
 *   npx tsx scripts/content/import-derivatives.ts --apply    # insert (skips pieces already imported)
 *   add --only=slug-a,slug-b to limit to some source files
 *
 * Reads brain/content/pipeline/derivatives/<source_slug>.json. Additive only, never updates or deletes.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TYPES = new Set(['youtube_long', 'short', 'ig_carousel', 'ig_lettering', 'social_twitter', 'reddit', 'email', 'social_tiktok', 'social_ig', 'blog']);
const DIR = path.resolve(process.cwd(), 'brain/content/pipeline/derivatives');
const apply = process.argv.includes('--apply');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;

type Piece = {
  piece_type: string;
  title: string;
  scheduled_for?: string;
  week?: number;
  body: string;
  source_excerpt?: string;
  platform_meta?: Record<string, unknown>;
};

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && (!only || only.has(f.replace(/\.json$/, ''))));
  let total = 0;
  let inserted = 0;
  const problems: string[] = [];

  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as { source_slug: string; pieces: Piece[] };
    const { data: post, error } = await supabase.from('content_posts').select('id, body').eq('slug', doc.source_slug).single();
    if (error || !post) {
      problems.push(`${f}: no content_posts row for slug ${doc.source_slug}`);
      continue;
    }

    const { data: existing } = await supabase.from('content_pieces').select('piece_type, title').eq('source_post_id', post.id);
    const seen = new Set((existing ?? []).map((e) => `${e.piece_type}|${e.title}`));

    const rows = [];
    for (const p of doc.pieces) {
      total++;
      if (!TYPES.has(p.piece_type)) problems.push(`${f}: unknown piece_type ${p.piece_type} (${p.title})`);
      if (p.scheduled_for && !/^\d{4}-\d{2}-\d{2}$/.test(p.scheduled_for)) problems.push(`${f}: bad date ${p.scheduled_for} (${p.title})`);
      if (/—/.test(p.body)) problems.push(`${f}: em dash in "${p.title}"`);
      if (p.source_excerpt && !post.body.includes(p.source_excerpt.trim())) problems.push(`${f}: excerpt not verbatim in article for "${p.title}"`);
      if (seen.has(`${p.piece_type}|${p.title}`)) continue;
      rows.push({
        source_post_id: post.id,
        piece_type: p.piece_type,
        title: p.title,
        body: p.body,
        scheduled_for: p.scheduled_for ?? null,
        source_excerpt: p.source_excerpt ?? null,
        platform_meta: { ...(p.platform_meta ?? {}), week: p.week ?? null, imported_from: `brain/content/pipeline/derivatives/${f}` },
        status: 'draft',
      });
    }
    console.log(`${doc.source_slug}: ${doc.pieces.length} pieces, ${rows.length} new`);
    if (apply && rows.length) {
      const { error: insErr, data } = await supabase.from('content_pieces').insert(rows).select('id');
      if (insErr) problems.push(`${f}: insert failed: ${insErr.message}`);
      else inserted += data.length;
    }
  }

  console.log(`\n${total} pieces in ${files.length} files. ${apply ? `${inserted} inserted.` : 'Dry run, nothing written.'}`);
  if (problems.length) console.log(`\nWarnings (${problems.length}):\n- ${problems.join('\n- ')}`);
}

main();
