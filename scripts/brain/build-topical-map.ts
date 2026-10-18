/**
 * Build the Quantum Strategies topical map: Austin's method as the frame, demand as the priority.
 *
 *   (a) seed the tree from content/architecture.json (pillar -> section -> topic -> subtopic) and the problem map
 *   (b) harvest demand: seed phrases (content/topical-map-seeds.json) through Google and YouTube autocomplete,
 *       a-z expansion for the top topics only; raw answers cached under scripts/research/.cache/topical-map/<date>/;
 *       1-3 s pacing with jitter; stops at the first 429/block; capped by --max-requests (printed)
 *   (c) cluster queries into topics and subtopics by embedding similarity (text-embedding-3-small, cached by
 *       text hash), with a reason on every placement; demand the architecture lacks becomes new topics
 *   (d) score demand, proof, coverage, competition, product fit and priority (formulas in lib/topical-map/score.ts)
 *   (e) write brain/content/topical-map.json + .md and upsert topic / query nodes and edges into the graph
 *
 * Flags:
 *   --brain-dir <dir>     brain root (default $BRAIN_DIR, else ./brain)
 *   --dry-run             cache only, no embeddings, no file or database writes; prints the summary
 *   --no-harvest          no network autocomplete: cached answers + audience + vidIQ only
 *   --no-embed            lexical similarity instead of embeddings
 *   --max-requests <n>    autocomplete request cap (default 600)
 *   --expand-top <n>      how many top topics get a-z expansion (default 5, budget permitting)
 *   --no-graph            write the files but not the graph
 *   --force-prune         prune stale topical-map graph rows even if the new map is much smaller
 *   --json                print the report as JSON
 *
 * Usage (app repo root; NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY for the full run):
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/build-topical-map.ts --brain-dir brain
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { restEnv } from './lib/graph/rest';
import { buildTopicalMap } from './lib/topical-map/build';
import { graphRows, landscapeIndex, writeGraph } from './lib/topical-map/graph';
import { renderTopicalMapMd } from './lib/topical-map/render';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const brainDir = path.resolve(val('--brain-dir') ?? process.env.BRAIN_DIR ?? 'brain');
  if (!existsSync(brainDir)) throw new Error(`brain dir not found: ${brainDir}`);
  const dryRun = has('--dry-run');
  const env = restEnv();
  const maxRequests = Number(val('--max-requests') ?? 600);
  if (!Number.isFinite(maxRequests) || maxRequests < 0) throw new Error('--max-requests must be a number >= 0');
  const cacheRoot = path.resolve('scripts/research/.cache/topical-map');
  const log = (m: string) => console.error(m);

  const result = await buildTopicalMap({
    brainDir,
    env: env ? { ...env, openaiKey: dryRun ? undefined : env.openaiKey } : null,
    harvest: !dryRun && !has('--no-harvest'),
    embed: !dryRun && !has('--no-embed'),
    maxRequests,
    expandTop: val('--expand-top') ? Number(val('--expand-top')) : undefined,
    cacheRoot,
    log,
  });
  const { map, report } = result;

  let written: Awaited<ReturnType<typeof writeGraph>> | null = null;
  if (!dryRun) {
    const out = path.join(brainDir, 'content');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'topical-map.json'), `${JSON.stringify(map, null, 1)}\n`);
    writeFileSync(path.join(out, 'topical-map.md'), renderTopicalMapMd(map));
    log(`wrote ${path.join(out, 'topical-map.json')} and topical-map.md`);
    if (!has('--no-graph')) {
      if (!env) log('graph: skipped (no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
      else {
        const landscapePath = path.join(brainDir, 'research/creators/landscape.json');
        const channels = existsSync(landscapePath) ? ((JSON.parse(readFileSync(landscapePath, 'utf8')) as { channels?: { name: string; channel_id: string }[] }).channels ?? []) : [];
        const rows = graphRows(result, landscapeIndex(channels));
        written = await writeGraph(env, rows, map.generatedAt, { forcePrune: has('--force-prune') });
      }
    }
  }

  if (has('--json')) {
    console.log(JSON.stringify({ report, graph: written }, null, 2));
    return;
  }
  const topics = map.nodes.filter((n) => n.level === 'topic').sort((a, b) => b.scores.priority - a.scores.priority);
  console.log(`${dryRun ? 'DRY RUN · ' : ''}topical map ${map.generatedAt}`);
  console.log(`\nnodes by level: ${Object.entries(report.counts).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`origins: ${Object.entries(report.origins).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const h = report.harvest;
  console.log(`\nautocomplete: ${h.requests} requests (cap ${maxRequests}), ${h.cacheHits} cache hits, ${h.missing} not fetched, ${h.errors} errors${h.blocked ? ` · BLOCKED: ${JSON.stringify(h.blocked)}` : ' · no blocks'}`);
  console.log(`expanded a-z: ${h.expandedTopics.join(', ') || 'none'}`);
  const q = report.queries;
  console.log(`queries: ${q.total} unique (${Object.entries(q.bySource).map(([k, v]) => `${k} ${v}`).join(', ')}) · placed ${q.placed} (${q.onSubtopics} on subtopics, ${q.inDemandTopics} in new demand topics) · unplaced ${q.unplaced} · dropped as off-topic ${q.offTopic}`);
  const e = report.embeddings;
  console.log(`embeddings: ${e.enabled ? `${e.embedded} embedded, ${e.cached} cached, ${e.tokens} tokens ≈ $${e.costUsd.toFixed(4)}` : 'off (lexical similarity)'}`);
  console.log(`proof: ${report.proof.mode}; ${report.proof.claimsWithEvidence} claims with evidence >= 0.45`);
  console.log(`content posts: ${report.contentPosts.linked} of ${report.contentPosts.total} linked by title`);
  console.log('\ntop 15 topics by priority:');
  for (const [i, t] of topics.slice(0, 15).entries()) {
    console.log(
      `${String(i + 1).padStart(2)}. [${t.scores.priority}] ${t.label}${t.origin !== 'architecture' ? ` (${t.origin})` : ''} · ${t.pillarCode} · ${t.status} · D${t.scores.demand} P${t.scores.proof} C${t.scores.coverage} K${t.scores.competition} F${t.scores.productFit}\n      ${t.queries.slice(0, 4).map((x) => `"${x.text}"`).join(', ')}`,
    );
  }
  if (written) console.log(`\ngraph: ${written.nodes} nodes, ${written.edges} edges upserted · ${written.skippedExistingCreators} existing creators reused · ${written.dangling} edges dropped (endpoint missing)${written.danglingSample.length ? ` e.g. ${written.danglingSample.join('; ')}` : ''} · pruned ${written.pruned.nodes} nodes, ${written.pruned.edges} edges`);
  if (report.warnings.length) console.log(`\nwarnings:\n${report.warnings.map((w) => `  - ${w}`).join('\n')}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
