/**
 * Cluster harvested queries into the tree. Pure: similarity functions are injected, so the same code runs on
 * embeddings (cosine, text-embedding-3-small) or on lexical overlap when embeddings are off.
 *
 * 1. assignQueries: each query goes to its nearest topic when the similarity clears `assign`. A query that a
 *    topic's own seed surfaced gets `seedBonus` toward that topic (autocomplete already tied them).
 * 2. attachSubtopics: inside a topic, a query moves down to the nearest existing subtopic when it clears `sub`.
 * 3. groupQueries: leftover queries (in a topic, or unplaced) are grouped greedily, highest signal first; a
 *    query joins the first group whose head it matches at `group`. Big enough groups become new subtopics or
 *    new demand topics.
 * Every placement carries a human-readable reason.
 */
import type { HarvestedQuery } from './queries';

export interface Thresholds {
  assign: number;
  seedBonus: number;
  sub: number;
  group: number;
  /** minimum group signal (sum) for a new subtopic / demand topic */
  minGroupSignal: number;
  /** minimum group size (a vidIQ- or probe-backed head counts as 2) */
  minGroupSize: number;
  /** stricter bar for a new demand topic (a new subtopic uses minGroupSignal / minGroupSize) */
  minTopicSignal: number;
  minTopicSize: number;
  /** an unplaced query this far from every node is off-topic and dropped */
  relevance: number;
}

export const EMBED_THRESHOLDS: Thresholds = { assign: 0.5, seedBonus: 0.08, sub: 0.55, group: 0.68, minGroupSignal: 3, minGroupSize: 2, minTopicSignal: 6, minTopicSize: 3, relevance: 0.4 };
export const LEXICAL_THRESHOLDS: Thresholds = { assign: 0.5, seedBonus: 0.3, sub: 0.6, group: 0.6, minGroupSignal: 3, minGroupSize: 2, minTopicSignal: 6, minTopicSize: 3, relevance: 0.25 };

export interface Placement {
  query: HarvestedQuery;
  topic: string | null;
  sim: number;
  reason: string;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function assignQueries(
  queries: HarvestedQuery[],
  topics: { id: string; label: string }[],
  sim: (q: HarvestedQuery, topicId: string) => number,
  t: Thresholds,
): Placement[] {
  return queries.map((q) => {
    const scored = topics
      .map((tp) => {
        const raw = sim(q, tp.id);
        const bonus = q.seedTopics.includes(tp.id) ? t.seedBonus : 0;
        return { tp, raw, s: raw + bonus, bonus };
      })
      .sort((a, b) => b.s - a.s);
    const best = scored[0];
    const next = scored[1];
    if (!best || best.s < t.assign) {
      return { query: q, topic: null, sim: best ? r3(best.raw) : 0, reason: best ? `no topic close enough: nearest "${best.tp.label}" at ${r3(best.raw)} (needs ${t.assign})` : 'no topics' };
    }
    const why = [`nearest topic "${best.tp.label}" at ${r3(best.raw)}`];
    if (best.bonus) why.push(`its own seed surfaced it (+${t.seedBonus})`);
    if (next) why.push(`next "${next.tp.label}" at ${r3(next.raw)}`);
    return { query: q, topic: best.tp.id, sim: r3(best.raw), reason: why.join('; ') };
  });
}

export function attachSubtopics(
  placed: Placement[],
  subtopicsOf: (topicId: string) => { id: string; label: string }[],
  sim: (q: HarvestedQuery, nodeId: string) => number,
  t: Thresholds,
): Map<string, Placement> {
  const out = new Map<string, Placement>(); // query key -> subtopic placement
  for (const p of placed) {
    if (!p.topic) continue;
    const subs = subtopicsOf(p.topic);
    let best: { id: string; label: string; s: number } | null = null;
    for (const s of subs) {
      const v = sim(p.query, s.id);
      if (!best || v > best.s) best = { ...s, s: v };
    }
    if (best && best.s >= t.sub) out.set(p.query.key, { query: p.query, topic: best.id, sim: r3(best.s), reason: `closest subtopic "${best.label}" at ${r3(best.s)} (needs ${t.sub})` });
  }
  return out;
}

export interface QueryGroup {
  head: HarvestedQuery;
  members: HarvestedQuery[];
  signal: number;
  reason: string;
}

/** Greedy grouping, highest signal first. `strong(q)` marks a head that counts double for size (vidIQ, probes). */
export function groupQueries(
  queries: HarvestedQuery[],
  sim: (a: HarvestedQuery, b: HarvestedQuery) => number,
  t: Thresholds,
  strong: (q: HarvestedQuery) => boolean = (q) => q.sources.includes('vidiq'),
): { groups: QueryGroup[]; rest: HarvestedQuery[] } {
  const sorted = [...queries].sort((a, b) => b.signal - a.signal || a.text.localeCompare(b.text));
  const raw: { head: HarvestedQuery; members: HarvestedQuery[]; sims: number[] }[] = [];
  for (const q of sorted) {
    let joined = false;
    for (const g of raw) {
      const s = sim(q, g.head);
      if (s >= t.group) {
        g.members.push(q);
        g.sims.push(s);
        joined = true;
        break;
      }
    }
    if (!joined) raw.push({ head: q, members: [q], sims: [1] });
  }
  const groups: QueryGroup[] = [];
  const rest: HarvestedQuery[] = [];
  for (const g of raw) {
    const signal = g.members.reduce((s, m) => s + m.signal, 0);
    const size = g.members.length + (strong(g.head) ? 1 : 0);
    if (size >= t.minGroupSize && signal >= t.minGroupSignal) {
      const minSim = Math.min(...g.sims);
      groups.push({
        head: g.head,
        members: g.members,
        signal: Math.round(signal * 100) / 100,
        reason: `${g.members.length} queries within ${t.group} of "${g.head.text}" (lowest ${r3(minSim)}), total signal ${Math.round(signal * 10) / 10}`,
      });
    } else rest.push(...g.members);
  }
  return { groups, rest };
}

/** Nearest node by similarity to a text-like key, optionally restricted. */
export function nearest<T extends { id: string }>(items: T[], score: (x: T) => number): { item: T; s: number } | null {
  let best: { item: T; s: number } | null = null;
  for (const it of items) {
    const s = score(it);
    if (!best || s > best.s) best = { item: it, s };
  }
  return best;
}
