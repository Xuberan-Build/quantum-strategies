/**
 * Content & Corpus Backup
 *
 * Companion to backup-database.ts. Exports the content-engine and knowledge-corpus
 * tables (including pgvector embeddings) as JSONL, paginated, into a backup folder.
 * Run before ANY migration or write that touches these tables.
 *
 * Usage:
 *   npm run backup:content                      # new timestamped folder
 *   npm run backup:content -- <backup-dir>      # add to an existing backup folder
 *
 * Fails (exit 1) if any table cannot be fully exported.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Ordered so parents come before children when restoring.
const CONTENT_TABLES = [
  'knowledge_sources',
  'knowledge_chunks',
  'content_pillars',
  'content_topics',
  'content_angles',
  'content_sections',
  'content_pieces',
  'content_corpus_links',
  'content_agent_runs',
  'content_posts',
  'corpus_ingestion_queue',
];

const PAGE_SIZE = 500;

async function exportTable(table: string, dir: string): Promise<number> {
  const file = path.join(dir, `${table}.jsonl`);
  const out = fs.createWriteStream(file);
  let from = 0;
  let total = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      out.close();
      // A table that was never deployed is reported, not fatal.
      if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message)) {
        fs.unlinkSync(file);
        console.log(`  - ${table}: not in this database, skipped`);
        return -1;
      }
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const row of data) out.write(JSON.stringify(row) + '\n');
    total += data.length;
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  await new Promise<void>((resolve) => out.end(resolve));

  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`${table} count: ${error.message}`);
  if (count !== total) throw new Error(`${table}: exported ${total} rows but table has ${count}`);
  return total;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(process.cwd(), 'backups', timestamp);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Content & corpus backup -> ${dir}\n`);

  const summary: Record<string, number> = {};
  for (const [i, table] of CONTENT_TABLES.entries()) {
    process.stdout.write(`[${i + 1}/${CONTENT_TABLES.length}] ${table}... `);
    const n = await exportTable(table, dir);
    if (n >= 0) {
      summary[table] = n;
      console.log(`${n} rows`);
    }
  }

  fs.writeFileSync(
    path.join(dir, 'content-backup-manifest.json'),
    JSON.stringify({ createdAt: new Date().toISOString(), format: 'jsonl', tables: summary }, null, 2),
  );
  console.log(`\nDone: ${Object.values(summary).reduce((a, b) => a + b, 0)} rows across ${Object.keys(summary).length} tables.`);
}

main().catch((err) => {
  console.error(`\nBACKUP FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
