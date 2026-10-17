/**
 * Print the knowledge graph's gaps (kg_gaps()) and write two brain notes:
 *   <out>/gaps.md                  readable gap report
 *   <out>/ingestion-proposals.md   proposed corpus_ingestion_queue rows for evidence gaps (NOT inserted)
 *
 * READ-ONLY on the database (kg_gaps RPC, kg_nodes, knowledge_chunks metadata). It never writes to
 * corpus_ingestion_queue: the founder approves proposals first.
 *
 * Flags: --brain-dir <dir> (default $BRAIN_DIR or ./brain) · --out-dir <dir> (default <brain>/graph) · --no-write · --json
 * Usage: NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/graph-gaps.ts --brain-dir brain
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gapHeadline, gapsMarkdown, groupGaps, GAP_TITLES, proposalsMarkdown, proposeIngestion, type GapRow, type StagedCard } from './lib/graph/gaps';
import { restEnv, restGet, restGetAll, restRpc } from './lib/graph/rest';

const args = process.argv.slice(2);
const val = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

function stagedCards(brainDir: string): Omit<StagedCard, 'ingested'>[] {
  const out: Omit<StagedCard, 'ingested'>[] = [];
  for (const f of ['corpus-staging/evidence.jsonl', 'corpus-staging/lineage-market.jsonl']) {
    const p = path.join(brainDir, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as { tradition: string; text_name: string; source_url?: string; metadata?: { card_key?: string; claims_supported?: string[]; citation?: string; tier?: string } };
        if (!r.metadata?.card_key) continue;
        out.push({ file: f, card_key: r.metadata.card_key, text_name: r.text_name, tradition: r.tradition, source_url: r.source_url ?? null, citation: r.metadata.citation ?? null, claims: r.metadata.claims_supported ?? [], tier: r.metadata.tier ?? null });
      } catch {
        /* skip malformed line */
      }
    }
  }
  return out;
}

async function main() {
  const env = restEnv();
  if (!env) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const brainDir = path.resolve(val('--brain-dir') ?? process.env.BRAIN_DIR ?? 'brain');
  const outDir = path.resolve(val('--out-dir') ?? path.join(brainDir, 'graph'));
  const rows = await restRpc<GapRow[]>(env, 'kg_gaps', {});
  const built = await restGet<{ built_at: string | null }>(env, 'kg_nodes?select=built_at&order=built_at.desc.nullslast&limit=1');
  const builtAt = built[0]?.built_at ?? null;
  const now = new Date().toISOString();

  if (args.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`kg_gaps · ${gapHeadline(rows)}`);
    for (const [type, items] of groupGaps(rows)) {
      console.log(`\n${GAP_TITLES[type] ?? type} (${items.length})`);
      for (const r of items.slice(0, 25)) console.log(`  ${r.node_id.padEnd(40)} ${r.label.slice(0, 90)}`);
      if (items.length > 25) console.log(`  … ${items.length - 25} more`);
    }
  }

  // Ingestion proposals for claim evidence gaps
  const cards = stagedCards(brainDir);
  const ingestedKeys = new Set(
    (await restGetAll<{ k: string | null }>(env, 'knowledge_chunks?select=k:metadata->>card_key&metadata->>card_key=not.is.null&order=id')).map((r) => r.k).filter((k): k is string => !!k),
  );
  const claimNodes = await restGetAll<{ id: string; cards: string[] | null }>(env, 'kg_nodes?select=id,cards:props->source_cards&type=eq.claim&order=id');
  const claimCards = new Map(claimNodes.map((c) => [c.id, c.cards ?? []]));
  const proposals = proposeIngestion(rows, claimCards, cards.map((c) => ({ ...c, ingested: ingestedKeys.has(c.card_key) })));
  console.log(`\ningestion proposals: ${proposals.proposals.length} rows · research tasks: ${proposals.research.length} (not queued; founder approves first)`);

  if (!args.includes('--no-write')) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'gaps.md'), gapsMarkdown(rows, builtAt, now));
    writeFileSync(path.join(outDir, 'ingestion-proposals.md'), proposalsMarkdown(proposals, now));
    console.log(`wrote ${path.join(outDir, 'gaps.md')} and ingestion-proposals.md`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
