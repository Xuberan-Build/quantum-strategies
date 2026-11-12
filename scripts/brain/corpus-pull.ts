/**
 * corpus-pull: search the QS knowledge corpus (knowledge_chunks) for teachings and findings. READ-ONLY.
 *
 * The corpus is the FIRST source for the wisdom bank (brain/content/narrative/wisdom-bank.md) and for
 * any tradition or research material in a brief or draft. Search here first, cite the chunk id, and go
 * to the web only for what the corpus doesn't hold.
 *
 * Usage (from the app repo root):
 *   npx tsx --env-file=.env --env-file=.env.local scripts/brain/corpus-pull.ts "<query>" \
 *     [--tradition sufism,taoism] [--text interior_castle,showings] [--limit 8] [--per-text 3] \
 *     [--tiers lineage,evidence | all] [--json]
 *
 *   query        Postgres websearch syntax: plain words, "a quoted phrase", -exclude, or
 *   --tradition  buddhism, christian_mysticism, hermeticism, hinduism, kabbalah, new_thought, qs_doctrine,
 *                rosicrucianism, science, sufism, tantra, taoism (creator_research needs --tiers all)
 *   --text       exact text_name(s), e.g. interior_castle, practice_of_presence, corpus_hermeticum, liezi
 *   --limit      passages to print (default 8, max 50)
 *   --per-text   max passages from one text (default 3), so one long book can't fill the list
 *   --tiers      default lineage,evidence,model,contested,enemy (the Kybalion is tier "enemy");
 *                "all" adds market_signal (creator research) and internal (QS notes)
 *   --json       machine output
 *
 * How it searches: Postgres full-text search on fts_content (english config). It runs the query as
 * written (every word must match), then broadens to ANY word if that finds too little, and ranks the
 * pool locally (distinct words matched, phrase, density; see lib/corpus-pull/format.ts).
 * No vector search: stored embeddings are the old 1536-dim OpenAI set and QS doesn't call OpenAI.
 *
 * Every hit prints a rights hint: "public-domain" (translation 1930 or earlier, quotable with credit),
 * "paraphrase" (in copyright or unclear), "check" (translator not recorded) or "paper" (cite the study).
 * It is a hint from the chunk's own translator/date fields, not legal advice: confirm before publishing.
 */
import { createClient } from '@supabase/supabase-js';
import { formatHit, hitJson, orQuery, parseArgs, queryTerms, rankRows, type CorpusRow, type PullOptions } from './lib/corpus-pull/format';

const COLUMNS = 'id, tradition, text_name, author, translator, date_composed, book, chapter, verse, lines, section, content, source_url, tier, metadata';

async function search(opts: PullOptions, text: string, max: number): Promise<CorpusRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (run with --env-file=.env --env-file=.env.local)');
  const client = createClient(url, key, { auth: { persistSession: false } });
  let q = client.from('knowledge_chunks').select(COLUMNS).textSearch('fts_content', text, { type: 'websearch', config: 'english' });
  if (opts.traditions.length) q = q.in('tradition', opts.traditions);
  if (opts.texts.length) q = q.in('text_name', opts.texts);
  if (opts.tiers) q = q.in('tier', opts.tiers);
  const { data, error } = await q.limit(max);
  if (error) throw new Error(`search failed: ${error.message}`);
  return (data ?? []) as CorpusRow[];
}

async function main() {
  let opts: PullOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
  const strict = await search(opts, opts.query, 200);
  const terms = queryTerms(opts.query);
  let pool = strict;
  if (strict.length < opts.limit * 3 && terms.length > 1) pool = [...strict, ...(await search(opts, orQuery(terms), 500))];
  const hits = rankRows(pool, opts.query, opts.limit, opts.perText);

  if (opts.json) {
    console.log(JSON.stringify({ query: opts.query, terms, traditions: opts.traditions, pool: pool.length, hits: hits.map(hitJson) }, null, 2));
    return;
  }
  console.log(`corpus-pull "${opts.query}"${opts.traditions.length ? ` · ${opts.traditions.join(',')}` : ''} · ${hits.length} of ${pool.length} candidates (${strict.length} matched every word)\n`);
  if (!hits.length) console.log('No passages. Try fewer or broader words, or drop --tradition.');
  for (const [i, h] of hits.entries()) console.log(`${formatHit(h, i)}\n`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
