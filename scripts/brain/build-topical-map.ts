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
 *   --keyword-planner <f> Google Keyword Planner export (raw UTF-16 .csv/.tsv or the normalised research/keywords/*.json);
 *                         repeatable. Splits demand into searchDemand (measured volume) and audienceDemand, adds
 *                         channelFit (search / youtube / quiz) and a head term per topic
 *   --kp-add-new [min]    also add Keyword Planner rows no map phrasing matches (a "Discover new keywords" export) as
 *                         queries of their own, from min monthly searches up (default 50); they cluster like any query
 *   --no-queue            do not rewrite content/topical-map-queue.md
 *   --replay-queries <f>  replay the autocomplete phrasings stored in an earlier topical-map.json (offline; for when
 *                         the autocomplete cache under scripts/research/.cache/topical-map is gone)
 *
 * Usage (app repo root; NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY for the full run):
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/build-topical-map.ts --brain-dir brain
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { restEnv } from './lib/graph/rest';
import { buildTopicalMap, replayQueriesFrom } from './lib/topical-map/build';
import { graphRows, landscapeIndex, writeGraph } from './lib/topical-map/graph';
import { loadKeywordPlanner } from './lib/topical-map/keyword-planner';
import { buildQueue, renderQueueMd, type ProductInfo } from './lib/topical-map/queue';
import { renderTopicalMapMd } from './lib/topical-map/render';
import { loadGraphConfig } from './lib/graph/config';
import { nodeId } from './lib/graph/ids';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const vals = (f: string) => args.flatMap((a, i) => (a === f && args[i + 1] ? [args[i + 1]] : []));

async function main() {
  const brainDir = path.resolve(val('--brain-dir') ?? process.env.BRAIN_DIR ?? 'brain');
  if (!existsSync(brainDir)) throw new Error(`brain dir not found: ${brainDir}`);
  const dryRun = has('--dry-run');
  const env = restEnv();
  const maxRequests = Number(val('--max-requests') ?? 600);
  if (!Number.isFinite(maxRequests) || maxRequests < 0) throw new Error('--max-requests must be a number >= 0');
  const cacheRoot = path.resolve('scripts/research/.cache/topical-map');
  const log = (m: string) => console.error(m);
  const keywordPlanner = vals('--keyword-planner').map((f) => {
    const kp = loadKeywordPlanner(path.resolve(f));
    log(`keyword planner: ${kp.rows.length} keywords from ${f} (${kp.source.location ?? 'location ?'}, ${kp.source.dateRange ?? 'dates ?'})`);
    return kp;
  });

  const result = await buildTopicalMap({
    brainDir,
    env: env ? { ...env, openaiKey: dryRun ? undefined : env.openaiKey } : null,
    harvest: !dryRun && !has('--no-harvest'),
    embed: !dryRun && !has('--no-embed'),
    maxRequests,
    expandTop: val('--expand-top') ? Number(val('--expand-top')) : undefined,
    cacheRoot,
    log,
    keywordPlanner,
    kpAddNewMin: has('--kp-add-new') ? (Number.isFinite(Number(val('--kp-add-new'))) ? Number(val('--kp-add-new')) : 50) : undefined,
    replayQueries: val('--replay-queries') ? replayQueriesFrom(JSON.parse(readFileSync(path.resolve(val('--replay-queries')!), 'utf8'))) : undefined,
  });
  const { map, report } = result;

  let written: Awaited<ReturnType<typeof writeGraph>> | null = null;
  if (!dryRun) {
    const out = path.join(brainDir, 'content');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'topical-map.json'), `${JSON.stringify(map, null, 1)}\n`);
    writeFileSync(path.join(out, 'topical-map.md'), renderTopicalMapMd(map));
    log(`wrote ${path.join(out, 'topical-map.json')} and topical-map.md`);
    if (!has('--no-queue')) {
      const { config } = loadGraphConfig(brainDir);
      const products = new Map<string, ProductInfo>(config.products.map((p) => [nodeId('product', p.slug), { label: p.name, status: p.status ?? 'status unverified' }]));
      writeFileSync(path.join(out, 'topical-map-queue.md'), renderQueueMd(buildQueue(map, products, 20), map));
      log(`wrote ${path.join(out, 'topical-map-queue.md')}`);
    }
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
      `${String(i + 1).padStart(2)}. [${t.scores.priority}] ${t.label}${t.origin !== 'architecture' ? ` (${t.origin})` : ''} · ${t.pillarCode} · ${t.status} · D${t.scores.demand} P${t.scores.proof} C${t.scores.coverage} K${t.scores.competition} F${t.scores.productFit}${t.searchVolume !== undefined ? ` · search ${t.searchVolume}/mo S${t.scores.searchDemand} A${t.scores.audienceDemand} · fit s${t.channelFit?.search} y${t.channelFit?.youtube} q${t.channelFit?.quiz}${t.headTerm ? ` · head "${t.headTerm.text}" ${t.headTerm.volume}` : ''}` : ''}\n      ${t.queries.slice(0, 4).map((x) => `"${x.text}"`).join(', ')}`,
    );
  }
  const k = report.keywordPlanner;
  if (k) console.log(`\nkeyword planner: ${k.rows} keywords (${k.withVolume} with volume) · ${k.matchedQueries} map phrasings matched, ${k.queriesWithVolume} with volume · ${k.unmatchedRows} KP rows matched no phrasing${k.unmatchedSample.length ? ` e.g. ${k.unmatchedSample.slice(0, 5).join('; ')}` : ''}`);
  if (written) console.log(`\ngraph: ${written.nodes} nodes, ${written.edges} edges upserted · ${written.skippedExistingCreators} existing creators reused · ${written.dangling} edges dropped (endpoint missing)${written.danglingSample.length ? ` e.g. ${written.danglingSample.join('; ')}` : ''} · pruned ${written.pruned.nodes} nodes, ${written.pruned.edges} edges`);
  if (report.warnings.length) console.log(`\nwarnings:\n${report.warnings.map((w) => `  - ${w}`).join('\n')}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
