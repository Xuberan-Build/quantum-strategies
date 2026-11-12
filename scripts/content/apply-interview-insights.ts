#!/usr/bin/env tsx
/**
 * Push interview insights into calendar pieces as suggestions (notes field only, never the body).
 *
 *   npx tsx scripts/content/apply-interview-insights.ts            # dry run
 *   npx tsx scripts/content/apply-interview-insights.ts --apply
 *
 * Reads brain/content/interviews/<slug>/insights.jsonl. Each line:
 *   {"id", "date", "quote", "point", "fills", "pieces": [piece ids], "tags", "consent", "confirmed"}
 * Appends `From interview <date> [<id>]: "<quote>" -> <fills>` to each listed piece's notes.
 * Idempotent: skips a piece whose notes already contain [<id>].
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DIR = path.resolve('brain/content/interviews');
const apply = process.argv.includes('--apply');

type Insight = { id: string; date: string; quote: string; point?: string; fills?: string; pieces?: string[]; consent?: string; confirmed?: boolean };

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let planned = 0;
  let written = 0;
  for (const slug of fs.existsSync(DIR) ? fs.readdirSync(DIR) : []) {
    const file = path.join(DIR, slug, 'insights.jsonl');
    if (!fs.existsSync(file)) continue;
    const insights = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Insight);
    for (const ins of insights) {
      for (const pid of ins.pieces ?? []) {
        const { data: piece } = await supabase.from('content_pieces').select('id, notes, title').eq('id', pid).single();
        if (!piece) {
          console.log(`  ! ${slug} ${ins.id}: piece ${pid} not found`);
          continue;
        }
        if ((piece.notes ?? '').includes(`[${ins.id}]`)) continue;
        const kind = (ins.tags ?? []).find((t: string) => ['lived', 'view', 'worked-out'].includes(t));
        const line = `From interview ${ins.date} [${ins.id}]${ins.confirmed ? ' (read back)' : ''}${kind ? ` (${kind})` : ''}: "${ins.quote}"${ins.fills ? ` -> ${ins.fills}` : ''}${ins.consent ? ` (consent: ${ins.consent})` : ''}`;
        planned++;
        console.log(`  ${slug} -> ${piece.title}: ${line.slice(0, 140)}`);
        if (apply) {
          const notes = piece.notes ? `${piece.notes}\n\n${line}` : line;
          const { error } = await supabase.from('content_pieces').update({ notes }).eq('id', pid);
          if (error) console.log(`  ! update failed: ${error.message}`);
          else written++;
        }
      }
    }
  }
  console.log(`\n${planned} suggestions ${apply ? `planned, ${written} written` : 'planned (dry run)'}`);
}

main();
