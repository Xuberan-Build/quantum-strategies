/**
 * Seed (or refresh) the `perception-read` row in product_definitions from READ_QUESTIONS.
 *
 * Usage:
 *   npx tsx scripts/read/seed-perception-read.ts --dry-run   # print the row, write nothing
 *   npx tsx scripts/read/seed-perception-read.ts             # upsert
 *
 * Requires migration 20261018100000_perception_read.sql (the flag columns).
 * Insert sets is_active = true. Refresh never touches is_active, so a deactivated Read
 * (the kill switch for /api/read/start) stays off.
 * Touches only the perception-read row. Run `npm run backup` first (CLAUDE.md).
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { READ_QUESTIONS } from '../../src/lib/read/questions';
import { buildPerceptionReadRow } from './perception-read-row';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const row = buildPerceptionReadRow(READ_QUESTIONS);

  if (dryRun) {
    console.log(JSON.stringify({ ...row, steps: `[${row.steps.length} questions: ${row.steps.map((s) => s.id).join(', ')}]` }, null, 2));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: existing, error: findError } = await supabase
    .from('product_definitions')
    .select('id, is_active')
    .eq('product_slug', row.product_slug)
    .maybeSingle();
  if (findError) throw new Error(`lookup failed: ${findError.message}`);

  if (existing) {
    const { error } = await supabase.from('product_definitions').update(row).eq('id', existing.id);
    if (error) throw new Error(`update failed: ${error.message}`);
    console.log(`Updated ${row.product_slug} (${row.total_steps} steps, is_active left as ${existing.is_active}).`);
  } else {
    const { error } = await supabase.from('product_definitions').insert({ ...row, is_active: true });
    if (error) throw new Error(`insert failed: ${error.message}`);
    console.log(`Inserted ${row.product_slug} (${row.total_steps} steps, active).`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
