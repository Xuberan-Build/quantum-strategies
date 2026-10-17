/**
 * Build the Quantum Strategies knowledge graph (kg_nodes / kg_edges) from the private brain and link
 * it to the knowledge corpus.
 *
 * Deterministic extractors (scripts/brain/lib/graph/extract-*.ts) read the brain; the corpus bridge
 * embeds claims, mechanisms and problems (text-embedding-3-small, cached by text hash) and runs the
 * read-only match_knowledge RPC. Writes are idempotent upserts keyed by node id / (src, dst, type).
 * Rows a source no longer produces are deleted by built_at, scoped to the extractors that ran.
 * Corpus tables are only ever read.
 *
 * Flags:
 *   --brain-dir <dir>   brain root (default $BRAIN_DIR, else ./brain)
 *   --config <file>     graph config (default <brain>/graph/config.json)
 *   --dry-run           extract and print counts + embedding cost estimate; no OpenAI calls, no writes
 *   --no-embed          don't call OpenAI; reuse stored embeddings (evidence links only for those)
 *   --no-corpus         skip the corpus bridge
 *   --only <name>       write one extractor's rows: notes|architecture|audience|problem-map|claims|records|corpus
 *   --force-prune       prune even if this build is less than half the size of the stored graph
 *   --json              print the report as JSON
 *
 * Usage (app repo root, needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY):
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/build-graph.ts --brain-dir brain
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildGraph } from './lib/graph/build';
import { restEnv } from './lib/graph/rest';
import { EXTRACTORS, type ExtractorName } from './lib/graph/types';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const brainDir = path.resolve(val('--brain-dir') ?? process.env.BRAIN_DIR ?? 'brain');
  if (!existsSync(brainDir)) throw new Error(`brain dir not found: ${brainDir}`);
  const only = (val('--only') ?? null) as ExtractorName | null;
  if (only && !EXTRACTORS.includes(only)) throw new Error(`--only must be one of ${EXTRACTORS.join(', ')}`);
  const dryRun = has('--dry-run');
  const env = restEnv();
  if (!env && !dryRun) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use --dry-run to extract without a database)');

  const report = await buildGraph(brainDir, val('--config'), env, {
    dryRun,
    embed: !has('--no-embed'),
    only,
    corpus: !has('--no-corpus'),
    forcePrune: has('--force-prune'),
    log: (m) => console.error(m),
  });

  if (has('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  const fmt = (r: Record<string, number>) => Object.entries(r).map(([k, v]) => `  ${k.padEnd(16)} ${v}`).join('\n');
  console.log(`${dryRun ? 'DRY RUN · ' : ''}knowledge graph build ${report.builtAt}${only ? ` (only ${only})` : ''}`);
  console.log(`\nnodes (${total(report.nodesByType)}):\n${fmt(report.nodesByType)}`);
  console.log(`\nedges (${total(report.edgesByType)}):\n${fmt(report.edgesByType)}`);
  const e = report.embeddings;
  console.log(
    `\nembeddings: ${e.embedded} embedded, ${e.cached} cached, ${e.skipped} not embedded · ` +
      (dryRun ? `estimate ~${e.estimatedTokens.toLocaleString()} tokens ≈ $${e.estimatedCostUsd.toFixed(4)}` : `${e.tokens.toLocaleString()} tokens ≈ $${e.costUsd.toFixed(4)}`),
  );
  if (!dryRun) {
    const ev = report.evidence;
    console.log(`evidence: ${ev.edges} evidences edges (median similarity ${ev.medianSimilarity?.toFixed(3) ?? 'n/a'}), ${ev.targetsWithEvidence} claims/mechanisms with evidence · demand: ${ev.demandEdges} edges (median ${ev.demandMedian?.toFixed(3) ?? 'n/a'})`);
    console.log(`written: ${report.written.nodes} nodes, ${report.written.edges} edges · pruned: ${report.deleted.nodes} nodes, ${report.deleted.edges} edges`);
  }
  if (report.warnings.length) console.log(`\nwarnings (${report.warnings.length}):\n${report.warnings.slice(0, 40).map((w) => `  - ${w}`).join('\n')}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
