/**
 * The content queue: the next pieces to make, picked from the topical map. Pure.
 *
 * Candidates are topics under QUEUE_MAX_COVERAGE coverage (never guardrail topics), by priority. Each queued topic
 * gives its main piece; the rest of the slots go to its strongest uncovered subtopics (at most two pieces per topic
 * family, so the queue spreads across the map). Video scripts are first-class: every main piece is a long video
 * unless the topic is a page-shaped (commercial or navigational) one.
 */
import { QUEUE_MAX_COVERAGE, type TopicNode, type TopicalMap } from '../../../../src/lib/brain/topical-map-types';

export interface QueueItem {
  rank: number;
  node: TopicNode;
  topic: TopicNode; // the topic-level ancestor (the node itself for topics)
  pillar: TopicNode | null;
  questions: string[];
  words: string[];
  evidence: { label: string; detail: string }[];
  products: { id: string; label: string; status: string }[];
  format: string;
  whyNow: string;
  evidenceGrade: 'strong' | 'medium' | 'thin';
}

export interface ProductInfo {
  label: string;
  status: string;
}

const pct = (n: number) => `${n}/100`;

/** A quote kept under 25 words (briefing standard 1.7), with its attribution tail when it has one. */
export function shortQuote(w: string): string {
  const m = w.match(/^(.*?)(\s*\([^()]*(?:likes|points|score)[^()]*\))?\s*$/);
  let body = (m?.[1] ?? w).trim().replace(/^["“]|["”]$/g, '').replace(/…$/, '');
  const words = body.split(/\s+/);
  if (words.length > 25) body = `${words.slice(0, 24).join(' ')}…`;
  return `"${body}"${m?.[2] ? m[2] : ''}`;
}

export function formatFor(node: TopicNode, map: TopicalMap): string {
  const kids = map.nodes.filter((n) => n.parent === node.id);
  const builtVideo = kids.find((k) => /Format: long_video/.test(k.notes) && k.status === 'BUILT');
  if (node.level === 'subtopic') {
    if (/Format: long_video/.test(node.notes)) return node.status === 'BUILT' ? 'Long video. The script is BUILT; shoot it.' : 'Long video script (8 to 14 min, video-script spec), then 2 Shorts cut from it';
    if (/Format: short/.test(node.notes)) return 'Short (30 to 60 s) answering the question in the first line, pointing to the parent long video';
    return 'Short (30 to 60 s) that answers the question, plus a section in the parent topic\'s long video';
  }
  if (builtVideo) return `Long video. "${builtVideo.label}" is BUILT; shoot it, then write the article version as the cornerstone`;
  if (node.intent === 'commercial' || node.intent === 'navigational') return 'Page (answers the search, ends at the free quiz), then a Short pointing to it';
  if (node.intent === 'comparison') return 'Long video script that compares the two answers on mechanism, plus the article version';
  return 'Long video script (8 to 14 min, video-script spec) as the lead, then the article version and 2 Shorts cut from the video';
}

function grade(node: TopicNode): 'strong' | 'medium' | 'thin' {
  const sources = new Set(node.queries.flatMap((q) => q.sources));
  const best = Math.max(0, ...(node.evidence ?? []).map((e) => e.similarity ?? 0));
  if (sources.size >= 3 && best >= 0.45) return 'strong';
  if (sources.size >= 2 || best >= 0.45) return 'medium';
  return 'thin';
}

export function buildQueue(map: TopicalMap, products: Map<string, ProductInfo>, n = 20, maxCoverage = QUEUE_MAX_COVERAGE): QueueItem[] {
  const byId = new Map(map.nodes.map((x) => [x.id, x]));
  const topicOf = (x: TopicNode): TopicNode => (x.level === 'subtopic' && x.parent ? (byId.get(x.parent) ?? x) : x);
  const pillarOf = (x: TopicNode): TopicNode | null => {
    let cur: TopicNode | undefined = x;
    for (let i = 0; i < 5 && cur; i++) {
      if (cur.level === 'pillar') return cur;
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    return null;
  };
  const topics = map.nodes
    .filter((x) => x.level === 'topic' && x.scores.coverage < maxCoverage && x.stance !== 'guardrail')
    .sort((a, b) => b.scores.priority - a.scores.priority || b.scores.demand - a.scores.demand);
  const picked: TopicNode[] = topics.slice(0, n);
  if (picked.length < n) {
    const used = new Map<string, number>(picked.map((t) => [t.id, 1]));
    const subs = map.nodes
      .filter((x) => x.level === 'subtopic' && x.parent && used.has(x.parent) && x.status !== 'LIVE' && x.queries.length > 0 && x.stance !== 'guardrail')
      .sort((a, b) => b.scores.priority - a.scores.priority);
    for (const s of subs) {
      if (picked.length >= n) break;
      if ((used.get(s.parent!) ?? 0) >= 2) continue;
      picked.push(s);
      used.set(s.parent!, (used.get(s.parent!) ?? 0) + 1);
    }
  }
  const topicRank = new Map(topics.map((t, i) => [t.id, i + 1]));
  const demandRank = new Map(map.nodes.filter((x) => x.level === 'topic').sort((a, b) => b.scores.demand - a.scores.demand).map((t, i) => [t.id, i + 1]));
  const allTopics = map.nodes.filter((x) => x.level === 'topic').length;
  return picked
    .sort((a, b) => b.scores.priority - a.scores.priority)
    .map((node, i) => {
      const topic = topicOf(node);
      const evidence = (node.evidence?.length ? node.evidence : (topic.evidence ?? [])).slice(0, 3).map((e) => ({
        label: e.claim ? `${e.claim.replace('claim:', '').toUpperCase()}: ${e.label}` : `Corpus passage: "${e.label}"`,
        detail: [e.tier ? `tier ${e.tier}` : null, e.strength ? `${e.strength.toLowerCase()} claim` : null, e.similarity !== null ? `best corpus match ${e.similarity.toFixed(2)} (${e.similarity >= 0.45 ? 'clears' : 'below'} the 0.45 evidence floor)` : 'not checked against the corpus', e.source && !e.claim ? `from ${e.source}` : null].filter(Boolean).join(', '),
      }));
      const prods = (node.mapsTo.products?.length ? node.mapsTo.products : (topic.mapsTo.products ?? [])).map((id) => ({ id, label: products.get(id)?.label ?? id.replace('product:', ''), status: products.get(id)?.status ?? 'status unverified' }));
      const why: string[] = [];
      const dr = demandRank.get(topic.id);
      why.push(`Demand ${pct(node.scores.demand)}${node.level === 'topic' && dr ? `, #${dr} of ${allTopics} topics` : ''}${node.queries.length ? ` from ${node.queries.length} searched phrasings` : ''}.`);
      why.push(node.scores.coverage === 0 ? 'Nothing on it is published yet.' : `Coverage ${pct(node.scores.coverage)}: ${node.reasons?.coverage ?? 'little published'}.`);
      why.push(node.scores.productFit >= 80 ? `It routes straight to a product (${node.reasons?.productFit ?? 'see products'}).` : node.scores.productFit >= 50 ? `It routes to a product that's TO BUILD or B2B (${node.reasons?.productFit ?? ''}).` : 'Weak product route: it builds authority and will not sell a Rite on its own.');
      if (node.scores.competition >= 60) why.push(`Crowded on YouTube (competition ${pct(node.scores.competition)}), so it needs Austin's mechanism angle to stand out.`);
      else if (node.scores.competition <= 20) why.push('Few tracked channels cover it, so it is open ground.');
      if (node.stance && node.stance !== 'use') why.push(`The search term is one QS ${node.stance === 'avoid' ? 'avoids' : 'reframes'} (audience-vocabulary.md): use it as the door, never as the promise.`);
      if (topicRank.get(topic.id) && node.level === 'subtopic') why.push(`Part of queue topic #${topicRank.get(topic.id)}.`);
      return {
        rank: i + 1,
        node,
        topic,
        pillar: pillarOf(node),
        questions: node.queries.slice(0, 5).map((q) => q.text),
        words: (topic.audienceWords ?? []).slice(0, 3),
        evidence,
        products: prods,
        format: formatFor(node, map),
        whyNow: why.join(' '),
        evidenceGrade: grade(node),
      };
    });
}

export function renderQueueMd(items: QueueItem[], map: TopicalMap): string {
  const L: string[] = [];
  L.push('# Topical map content queue');
  L.push('');
  L.push(`Status: generated ${new Date().toISOString().slice(0, 10)} from \`content/topical-map.json\` (built ${map.generatedAt.slice(0, 10)}) by \`scripts/brain/topical-map-queue.ts\`. Follows \`content/briefing-standard.md\`. Do not edit by hand; rebuild the map.`);
  L.push('');
  L.push('**What this is.** The next pieces to make, in order. Each topic is a place where people search or talk (demand), Austin has something backed to say (proof), nothing much is published yet (coverage), and the piece can route to a Rite or a scan (fit). Video scripts come first. Topics QS treats as out of scope (trauma, depression, ADHD) never enter the queue.');
  L.push('');
  L.push('**How to use it.** Take the top item, brief it with the questions and the audience words below, cite only the evidence listed (and only what clears the 0.45 floor as support), and end on the route named. Statuses: LIVE exists today, BUILT made but not launched, TO BUILD planned.');
  L.push('');
  if (items[0]) {
    const t = items[0];
    L.push(`**Headline.** Make "${t.node.label}" first: ${t.format.charAt(0).toLowerCase()}${t.format.slice(1)}. ${t.whyNow}`);
    L.push('');
  }
  L.push('| # | Piece | Pillar | Priority | Demand | Proof | Coverage | Format |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const it of items) L.push(`| ${it.rank} | ${it.node.label.replace(/\|/g, '/')}${it.node.level === 'subtopic' ? ` (in ${it.topic.label.replace(/\|/g, '/')})` : ''} | ${it.pillar?.label ?? it.node.pillarCode} | ${it.node.scores.priority} | ${it.node.scores.demand} | ${it.node.scores.proof} | ${it.node.scores.coverage} | ${it.format.split(/[.,(]/)[0].trim()} |`);
  L.push('');
  for (const it of items) {
    L.push(`## ${it.rank}. ${it.node.label}`);
    L.push('');
    L.push(`**What.** ${it.node.level === 'subtopic' ? `A question under "${it.topic.label}"` : 'A topic'} in ${it.pillar?.label ?? it.node.pillarCode}${it.node.origin === 'demand' ? '. Found in search demand; Austin\'s architecture has no cluster for it yet' : it.node.origin === 'problem' ? '. A problem from the problem map that no cluster covers' : ''}. Status: ${it.node.status}. Scores: demand ${it.node.scores.demand}, proof ${it.node.scores.proof}, coverage ${it.node.scores.coverage}, competition ${it.node.scores.competition}, product fit ${it.node.scores.productFit}, priority ${it.node.scores.priority}.`);
    L.push('');
    L.push(`**Questions it answers.** ${it.questions.length ? it.questions.map((q) => `"${q}"`).join(', ') : 'No harvested phrasing yet; demand comes from coded audience items.'}`);
    L.push('');
    if (it.words.length) {
      L.push('**Their words** (problem map and coded comments, YouTube and Reddit, 2026):');
      for (const w of it.words) L.push(`- ${shortQuote(w)}`);
      L.push('');
    }
    L.push('**Evidence to cite.**');
    if (it.evidence.length) for (const e of it.evidence) L.push(`- ${e.label} (${e.detail})`);
    else L.push('- None linked. Treat it as Austin\'s model and say so, or add a source before publishing.');
    L.push('');
    L.push(`**Routes to.** ${it.products.length ? it.products.map((p) => `${p.label} (${p.status})`).join(', ') : 'No product route; end on the free quiz (TO BUILD) or the pillar hub.'}`);
    L.push('');
    L.push(`**Format.** ${it.format}.`);
    L.push('');
    L.push(`**Why now.** ${it.whyNow}`);
    L.push('');
    L.push(`Evidence: ${it.evidenceGrade}. ${it.node.queries.length} searched phrasings from ${[...new Set(it.node.queries.flatMap((q) => q.sources))].join(', ') || 'no autocomplete source'}; ${it.evidence.filter((e) => /clears/.test(e.detail)).length} evidence link(s) above the floor. Scores are relative to this map, never market sizes.`);
    L.push('');
  }
  return `${L.join('\n')}\n`;
}
