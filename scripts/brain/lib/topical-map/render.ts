/**
 * brain/content/topical-map.md, rendered from topical-map.json. Pure. Never edit the .md by hand:
 * edit the seeds or the architecture and rebuild.
 */
import type { TopicNode, TopicalMap } from '../../../../src/lib/brain/topical-map-types';

const sc = (n: TopicNode) => `D ${n.scores.demand} · P ${n.scores.proof} · C ${n.scores.coverage} · K ${n.scores.competition} · F ${n.scores.productFit} · **${n.scores.priority}**`;
const qs = (n: TopicNode, k = 4) => n.queries.slice(0, k).map((q) => `"${q.text}"`).join(', ');
const esc = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? 'n/a' : n.toLocaleString('en-US'));
const pct = (n: number | null | undefined) => (n === null || n === undefined ? 'n/a' : `${n >= 0 ? '+' : ''}${Math.round(n)}%`);

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
  const hasKp = by('topic').some((n) => n.searchVolume !== undefined);
  if (hasKp) {
    L.push('| S search demand | How many people type it into Google | Google Keyword Planner average monthly searches (US) summed over the phrasings placed here, close variants counted once, suspected spikes counted at their pre-spike level; `100 · log10(1+V) / log10(1+max V)` at the same level |');
    L.push('| A audience demand | How much people say it in comments and posts | The demand formula above without Keyword Planner: coded audience items and likes, autocomplete presence, vidIQ anchors |');
    L.push('| D (with Keyword Planner) | The blend | `0.6 · max(S, A) + 0.4 · min(S, A)`: the stronger channel leads, so a comment-only problem stays visible and a search-only term rises. No measurable volume is a missing reading: D = A |');
  }
  L.push('| **priority** | What to make next | `100 · D^0.45 · (0.35+0.65P)^0.2 · (1-0.85C)^0.2 · (0.25+0.75F)^0.15 · (1-0.3K) · stance`, stance 1 use, 0.9 reframe, 0.5 avoid, 0.3 guardrail |');
  L.push('');
  L.push('Status: **LIVE** a stranger can reach something on it (including pages that need a refresh) · **BUILT** made, not launched · **TO BUILD** planned in the architecture · **NONE** nothing planned yet.');
  L.push('');

  L.push('## Top 25 topics by priority');
  L.push('');
  const top = by('topic').sort((a, b) => b.scores.priority - a.scores.priority).slice(0, 25);
  if (hasKp) {
    L.push('| # | Topic | Pillar | Status | Search/mo | S | A | D | P | C | K | F | Priority | Title on (search) | Hook (their words) |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    top.forEach((n, i) => {
      L.push(`| ${i + 1} | ${esc(n.label)}${n.origin === 'demand' ? ' *(demand)*' : n.origin === 'problem' ? ' *(problem)*' : ''} | ${n.pillarCode} | ${n.status} | ${fmt(n.searchVolume)} | ${n.scores.searchDemand ?? ''} | ${n.scores.audienceDemand ?? ''} | ${n.scores.demand} | ${n.scores.proof} | ${n.scores.coverage} | ${n.scores.competition} | ${n.scores.productFit} | **${n.scores.priority}** | ${n.headTerm ? `"${esc(n.headTerm.text)}" ${fmt(n.headTerm.volume)}` : 'none measurable'} | ${n.headTerm?.audience ? `"${esc(n.headTerm.audience)}"` : ''} |`);
    });
  } else {
    L.push('| # | Topic | Pillar | Status | D | P | C | K | F | Priority | Top queries |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|');
    top.forEach((n, i) => {
      L.push(`| ${i + 1} | ${esc(n.label)}${n.origin === 'demand' ? ' *(demand)*' : n.origin === 'problem' ? ' *(problem)*' : ''} | ${n.pillarCode} | ${n.status} | ${n.scores.demand} | ${n.scores.proof} | ${n.scores.coverage} | ${n.scores.competition} | ${n.scores.productFit} | **${n.scores.priority}** | ${esc(qs(n, 3))} |`);
    });
  }
  L.push('');

  if (hasKp) {
    const kpMeta = (map.meta as { keywordPlanner?: { rows?: number; withVolume?: number; queriesWithVolume?: number; sources?: { location?: string | null; dateRange?: string | null }[] } } | undefined)?.keywordPlanner;
    L.push('## Search demand and audience demand');
    L.push('');
    L.push(`Keyword Planner: ${fmt(kpMeta?.rows)} keywords looked up (${fmt(kpMeta?.withVolume)} with volume), ${kpMeta?.sources?.[0]?.location ?? 'location n/a'}, ${kpMeta?.sources?.[0]?.dateRange ?? 'dates n/a'}. Search volume is rounded into Google's buckets (10, 20, 30, 40, 50, 70, 90, 110, 140, 170, 210, 260, 320, 390, 480, 590, 720, 880, 1K, 1.3K, 1.6K, 1.9K, 2.4K, 2.9K, 3.6K, 4.4K, 5.4K, 6.6K, 8.1K, 9.9K, 12.1K, 14.8K, 18.1K, 22.2K, 27.1K, 33.1K, 40.5K, 49.5K, 60.5K, 74K, 90.5K, 110K, 135K, 165K, 201K and up).`);
    L.push('');
    const topics = by('topic').filter((n) => n.stance !== 'guardrail');
    const gap = [...topics].filter((n) => (n.scores.audienceDemand ?? 0) - (n.scores.searchDemand ?? 0) >= 20).sort((a, b) => (b.scores.audienceDemand ?? 0) - (a.scores.audienceDemand ?? 0)).slice(0, 10);
    L.push('**Said, not searched** (audience demand at least 20 above search demand: make these as video and quiz questions, title them on the head term where one exists):');
    L.push('');
    for (const n of gap) L.push(`- **${n.label}** · search ${fmt(n.searchVolume)}/mo (S ${n.scores.searchDemand}) · audience A ${n.scores.audienceDemand}${n.headTerm ? ` · title on "${n.headTerm.text}" (${fmt(n.headTerm.volume)})` : ' · no search head term yet'}`);
    L.push('');
    const searched = [...topics].filter((n) => (n.scores.searchDemand ?? 0) - (n.scores.audienceDemand ?? 0) >= 10).sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0)).slice(0, 10);
    L.push('**Searched more than said** (search demand at least 10 above audience demand: SEO pages pay off here):');
    L.push('');
    for (const n of searched) L.push(`- **${n.label}** · ${fmt(n.searchVolume)}/mo (S ${n.scores.searchDemand}, A ${n.scores.audienceDemand}) · YoY ${pct(n.searchTrend?.yoy)} · led by ${(n.searchTerms ?? []).slice(0, 3).map((t) => `"${t.keyword}" ${fmt(t.volume)}`).join(', ')}`);
    L.push('');
    L.push('### The queue per channel');
    L.push('');
    for (const [k, label] of [['search', 'Search pages'], ['youtube', 'YouTube videos'], ['quiz', 'Quiz questions']] as const) {
      const ranked = [...topics].filter((n) => n.scores.coverage < (meta.queueMaxCoverage ?? 40) && n.channelFit).sort((a, b) => (b.channelFit![k] - a.channelFit![k]) || b.scores.priority - a.scores.priority).slice(0, 10);
      L.push(`**${label}** (channel fit 0 to 100): ${ranked.map((n, i) => `${i + 1}. ${n.label} ${n.channelFit![k]}`).join(' · ')}`);
      L.push('');
    }
  }

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
        if (t.searchVolume !== undefined) L.push(`  - Search: ${fmt(t.searchVolume)}/mo (S ${t.scores.searchDemand}, A ${t.scores.audienceDemand}, YoY ${pct(t.searchTrend?.yoy)})${t.headTerm ? ` · title on "${t.headTerm.text}" (${fmt(t.headTerm.volume)})` : ''}${t.channelFit ? ` · fit search ${t.channelFit.search}, YouTube ${t.channelFit.youtube}, quiz ${t.channelFit.quiz}` : ''}`);
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
