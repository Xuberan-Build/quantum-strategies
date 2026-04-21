/**
 * Seed the prompts table from product_definitions.
 * Reads system_prompt and final_deliverable_prompt from every product
 * and inserts them as version 1 active entries in the prompts table.
 * Safe to re-run — skips scopes that already have an active version.
 *
 * Run: npx tsx scripts/seed-prompts.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const serviceKey = process.env['SUPABASE_SERVICE_ROLE' + '_KEY']!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceKey
);

async function seed() {
  // Load all products with their prompt columns
  const { data: products, error } = await supabase
    .from('product_definitions')
    .select('product_slug, system_prompt, final_deliverable_prompt')
    .order('product_slug');

  if (error) {
    console.error('Failed to load products:', error.message);
    process.exit(1);
  }

  console.log(`Found ${products.length} products.\n`);

  // Load existing active prompts so we can skip them
  const { data: existing } = await supabase
    .from('prompts')
    .select('product_slug, scope')
    .eq('is_active', true);

  const existingSet = new Set(
    (existing ?? []).map((r) => `${r.product_slug}:${r.scope}`)
  );

  const toInsert: {
    product_slug: string;
    scope: string;
    step_number: null;
    content: string;
    version: number;
    is_active: boolean;
  }[] = [];

  for (const product of products) {
    const pairs: { scope: string; content: string | null }[] = [
      { scope: 'system', content: product.system_prompt },
      { scope: 'final_briefing', content: product.final_deliverable_prompt },
    ];

    for (const { scope, content } of pairs) {
      if (!content?.trim()) continue;
      const key = `${product.product_slug}:${scope}`;
      if (existingSet.has(key)) {
        console.log(`  SKIP  [${product.product_slug}] ${scope} (already active)`);
        continue;
      }
      toInsert.push({
        product_slug: product.product_slug,
        scope,
        step_number: null,
        content: content.trim(),
        version: 1,
        is_active: true,
      });
    }
  }

  if (toInsert.length === 0) {
    console.log('\nAll prompts already seeded — nothing to do.');
    return;
  }

  console.log(`\nInserting ${toInsert.length} prompts...\n`);

  let ok = 0;
  let fail = 0;

  for (const row of toInsert) {
    const { error: insertError } = await supabase.from('prompts').insert(row);
    if (insertError) {
      console.error(`  FAIL  [${row.product_slug}] ${row.scope}: ${insertError.message}`);
      fail++;
    } else {
      console.log(`  OK    [${row.product_slug}] ${row.scope}`);
      ok++;
    }
  }

  console.log(`\nDone. ${ok} inserted, ${fail} failed.`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
