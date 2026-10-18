/**
 * brain/content/topical-map.md, rendered from topical-map.json. Pure. Never edit the .md by hand:
 * edit the seeds or the architecture and rebuild.
 */
import type { TopicNode, TopicalMap } from '../../../../src/lib/brain/topical-map-types';

const sc = (n: TopicNode) => `D ${n.scores.demand} · P ${n.scores.proof} · C ${n.scores.coverage} · K ${n.scores.competition} · F ${n.scores.productFit} · **${n.scores.priority}**`;
const qs = (n: TopicNode, k = 4) => n.queries.slice(0, k).map((q) => `"${q.text}"`).join(', ');
const esc = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');

export function renderTopicalMapMd(map: TopicalMap): string {
  const nodes = map.nodes;
  const kids = (id: string | null) => nodes.filter((n) => n.parent === id);
  const by = (level: string) => nodes.filter((n) => n.level === level);
  const meta = (map.meta ?? {}) as { harvest?: { requests?: number; cacheHits?: number; blocked?: unknown; expandedTopics?: string[] }; queries?: Record<string, unknown>; embeddings?: { enabled?: boolean }; proof?: { mode?: string }; unplacedSample?: string[]; queueMaxCoverage?: number };
  const L: string[] = [];
  L.push('# Topical map');
  L.push('');
  L.push(`Status: generated ${map.generatedAt.slice(0, 10)} by \`scripts/brain/build-topical-map.ts\` from \`content/topical-map.json\`. Do not edit by hand. Seeds: \`content/topical-map-seeds.json\`.`);
  L.push('');
  L.push(`**Central entity.** ${map.centralEntity.label}. ${map.centralEntity.definition}`);
  L.push('');
  L.push(`**Source context.** ${map.sourceContext}`);
  L.push('');
  const counts = Object.fromEntries(map.levels.map((l) => [l, by(l).length]));
  const demandTopics = by('topic').filter((n) => n.origin === 'demand').length;
  const problemTopics = by('topic').filter((n) => n.origin === 'problem').length;
  const demandSubs = by('subtopic').filter((n) => n.origin === 'demand').length;
  L.push(`**Shape.** ${counts.pillar} pillars · ${counts.section} sections · ${counts.topic} topics (${demandTopics} from demand, ${problemTopics} from the problem map) · ${counts.subtopic} subtopics (${demandSubs} from harvested questions).`);
  L.push('');
  L.push(`**Data.** ${meta.harvest?.requests ?? 0} autocomplete requests this run, ${meta.harvest?.cacheHits ?? 0} answers from cache${meta.harvest?.blocked ? `, harvest stopped by a block (${JSON.stringify(meta.harvest.blocked)})` : ', no blocks'}. Similarity: ${meta.embeddings?.enabled ? 'embeddings (text-embedding-3-small)' : 'lexical overlap (embeddings off)'}. Proof: ${meta.proof?.mode ?? 'n/a'}.`);
  L.push('');
  L.push('## How to read the scores');
  L.push('');
  L.push('All scores are 0 to 100 and relative to this map. They rank topics against each other; none is a market size.');
  L.push('');
  L.push('| Score | What it measures | How |');
  L.push('|---|---|---|');
  L.push('| D demand | How much people search and talk about it | Top 15 query signals (Google and YouTube autocomplete rank, vidIQ volume, coded audience items and likes) plus the audience mass of the problems it answers, log-scaled against the biggest topic at the same level |');
  L.push('| P proof | How well the corpus backs what Austin would say | Best evidence similarity (0.45 is the evidence floor) for the topic and its linked claims, plus the claim grade (Strong, Moderate, Weak) |');
  L.push('| C coverage | What already exists | LIVE or needs-work cornerstones and spokes, BUILT pieces, published articles matched by title, internal decks and docs (small weight) |');
  L.push('| K competition | How crowded it is on YouTube | Landscape channels that cover it, weighted by audience overlap and how far their matching video beat their own median |');
  L.push('| F product fit | Whether it routes to a Rite or a scan | LIVE scan via the quiz route 100, LIVE product 90, Rite I via the quiz 80, Orientation or Declaration (TO BUILD) 60, B2B project 50 |');
  L.push('| **priority** | What to make next | `100 · D^0.45 · (0.35+0.65P)^0.2 · (1-0.85C)^0.2 · (0.25+0.75F)^0.15 · (1-0.3K) · stance`, stance 1 use, 0.9 reframe, 0.5 avoid, 0.3 guardrail |');
  L.push('');
  L.push('Status: **LIVE** a stranger can reach something on it (including pages that need a refresh) · **BUILT** made, not launched · **TO BUILD** planned in the architecture · **NONE** nothing planned yet.');
  L.push('');

  L.push('## Top 25 topics by priority');
  L.push('');
  L.push('| # | Topic | Pillar | Status | D | P | C | K | F | Priority | Top queries |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  by('topic')
    .sort((a, b) => b.scores.priority - a.scores.priority)
    .slice(0, 25)
    .forEach((n, i) => {
      L.push(`| ${i + 1} | ${esc(n.label)}${n.origin === 'demand' ? ' *(demand)*' : n.origin === 'problem' ? ' *(problem)*' : ''} | ${n.pillarCode} | ${n.status} | ${n.scores.demand} | ${n.scores.proof} | ${n.scores.coverage} | ${n.scores.competition} | ${n.scores.productFit} | **${n.scores.priority}** | ${esc(qs(n, 3))} |`);
    });
  L.push('');

  L.push('## Demand the architecture lacks');
  L.push('');
  const dem = by('topic').filter((n) => n.origin !== 'architecture' && n.origin !== undefined);
  if (!dem.length) L.push('None this run.');
  for (const n of dem.sort((a, b) => b.scores.priority - a.scores.priority)) {
    const parent = nodes.find((x) => x.id === n.parent);
    L.push(`- **${n.label}** (${n.origin}${n.stance && n.stance !== 'use' ? `, stance ${n.stance}` : ''}) under ${parent?.label ?? '?'} · ${sc(n)} · ${qs(n, 4)}`);
  }
  L.push('');

  L.push('## The tree');
  L.push('');
  for (const p of kids(null)) {
    L.push(`### ${p.pillarCode} · ${p.label}`);
    L.push('');
    L.push(`${p.status} · ${sc(p)}${p.summary ? `. ${p.summary}` : ''}`);
    L.push('');
    for (const s of kids(p.id)) {
      L.push(`#### ${s.label}`);
      L.push('');
      L.push(`${s.status} · ${sc(s)}`);
      L.push('');
      for (const t of kids(s.id)) {
        L.push(`- **${t.label}**${t.origin && t.origin !== 'architecture' ? ` *(${t.origin})*` : ''} · ${t.status} · ${sc(t)}${t.queueRank ? ` · queue #${t.queueRank}` : ''}`);
        if (t.queries.length) L.push(`  - Searched as: ${qs(t, 6)}`);
        if (t.mapsTo.problems?.length) L.push(`  - Problems: ${t.mapsTo.problems.map((x) => x.replace('problem:', '')).join(', ')}`);
        if (t.mapsTo.products?.length) L.push(`  - Routes to: ${t.mapsTo.products.map((x) => x.replace('product:', '')).join(', ')}`);
        const subs = kids(t.id).sort((a, b) => b.scores.priority - a.scores.priority);
        const shown = subs.slice(0, 6);
        for (const st of shown) L.push(`  - ${st.label}${st.origin === 'demand' ? ' *(question)*' : ''} · ${st.status} · pri ${st.scores.priority}${st.queries.length ? ` · ${qs(st, 2)}` : ''}`);
        if (subs.length > shown.length) L.push(`  - …and ${subs.length - shown.length} more subtopics in the JSON`);
      }
      L.push('');
    }
  }

  if (meta.unplacedSample?.length) {
    L.push('## Queries that fit nowhere (sample)');
    L.push('');
    L.push(`Harvested, but no topic was close enough and they didn't group into a new one: ${meta.unplacedSample.map((q) => `"${q}"`).join(', ')}.`);
    L.push('');
  }
  return `${L.join('\n')}\n`;
}
