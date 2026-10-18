/**
 * Client-safe helpers for /admin/brain/map: metric definitions, the colour ramp,
 * the sunburst (partition) layout, filter matching, URL state and the plain-words
 * "why" lines. Pure functions, no brain content, no data access.
 *
 * Types come from the contract in ./topical-map (type-only imports, so nothing
 * server-side reaches the client bundle).
 */
import type { getTopicalQueue, TopicalMap, TopicNode, TopicScorecard } from './topical-map';

export type { TopicalMap, TopicNode, TopicScorecard };
export type TopicStatus = TopicNode['status'];
export type TopicIntent = TopicNode['intent'];
export type TopicLevel = TopicNode['level'];
export type QueueItem = Awaited<ReturnType<typeof getTopicalQueue>>[number];

export type TopicalMapPayload = TopicalMap & { fixture?: boolean; error?: string };
export type TopicPayload = TopicScorecard & { fixture?: boolean };
export type QueuePayload = { items: QueueItem[]; fixture?: boolean; error?: string };

/* ---------------------------------------------------------------- metrics */

export const METRICS = ['priority', 'demand', 'proof', 'coverage', 'competition'] as const;
export type Metric = (typeof METRICS)[number];
export type ScoreKey = keyof TopicNode['scores'];
export const SCORE_KEYS: readonly ScoreKey[] = ['priority', 'demand', 'proof', 'coverage', 'competition', 'productFit'];

export const METRIC_INFO: Record<ScoreKey, { label: string; definition: string; high: string; low: string }> = {
  priority: {
    label: 'Priority',
    definition: 'What to make next. High demand and product fit with little coverage rank first; heavy competition pulls a topic down.',
    high: 'make soon',
    low: 'can wait',
  },
  demand: {
    label: 'Demand',
    definition: 'How often people search and talk about this; from search autocomplete and audience comments.',
    high: 'asked a lot',
    low: 'rarely asked',
  },
  proof: {
    label: 'Proof',
    definition: "How well Austin's own corpus backs a claim here; from the closest matching evidence in the knowledge base.",
    high: 'well backed',
    low: 'unbacked',
  },
  coverage: {
    label: 'Coverage',
    definition: 'How much he already has on this. A LIVE asset counts most, then BUILT, then planned.',
    high: 'covered',
    low: 'open gap',
  },
  competition: {
    label: 'Competition',
    definition: 'How crowded it is: how many tracked creators cover it and how far their videos outperform. Context only.',
    high: 'crowded',
    low: 'open field',
  },
  productFit: {
    label: 'Product fit',
    definition: 'How directly it leads to a Rite, the free quiz or the beta.',
    high: 'leads to a product',
    low: 'no route yet',
  },
};

/** Sequential ramp on the dark brain surface: dim umber to pale gold (extends viz.HEAT_RAMP). */
export const RAMP = ['#2e2218', '#4f3622', '#7a512c', '#a86f38', '#d39a58', '#f0cf8f'] as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Colour for a 0-100 score. */
export function rampColor(score: number): string {
  const t = Math.max(0, Math.min(1, (Number.isFinite(score) ? score : 0) / 100)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  const f = t - i;
  const a = hexToRgb(RAMP[i]);
  const b = hexToRgb(RAMP[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function band(score: number): 'high' | 'medium' | 'low' {
  return score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
}

/* ---------------------------------------------------------------- status / intent */

export const STATUSES: readonly TopicStatus[] = ['LIVE', 'BUILT', 'TO BUILD', 'NONE'];
export const STATUS_INFO: Record<TopicStatus, { label: string; definition: string }> = {
  LIVE: { label: 'LIVE', definition: 'Something public covers it: a page, article or video people can reach today.' },
  BUILT: { label: 'BUILT', definition: 'Made but not launched: a script or draft that passes review and waits to ship.' },
  'TO BUILD': { label: 'TO BUILD', definition: 'Planned. An angle or brief exists, nothing is made yet.' },
  NONE: { label: 'Nothing yet', definition: 'No asset and no plan.' },
};

export const INTENTS: readonly TopicIntent[] = ['informational', 'problem', 'comparison', 'commercial', 'navigational'];
export const INTENT_LABEL: Record<TopicIntent, string> = {
  informational: 'Wants to understand',
  problem: 'Has a problem',
  comparison: 'Comparing options',
  commercial: 'Ready to buy',
  navigational: 'Looking for us',
};

export const LEVEL_LABEL: Record<TopicLevel, string> = {
  pillar: 'Pillar',
  section: 'Section',
  topic: 'Topic',
  subtopic: 'Subtopic',
};

/* ---------------------------------------------------------------- ids */

export const TOPIC_ID = /^topic:[A-Za-z0-9][A-Za-z0-9._:/@+~-]{0,239}$/;
export const isTopicId = (v: unknown): v is string => typeof v === 'string' && TOPIC_ID.test(v) && !v.includes('..');
export const topicApiPath = (id: string) => `/api/admin/brain/map/topic/${id.split('/').map(encodeURIComponent).join('/')}`;
/** Queue size from ?limit=, defaulting to 20 and clamped to 1..100. */
export function parseQueueLimit(raw: string | null): number {
  const n = Number(raw);
  if (raw == null || raw === '' || !Number.isFinite(n)) return 20;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

export const graphHref =(id: string) => `/admin/brain/graph?node=${encodeURIComponent(id)}`;

/* ---------------------------------------------------------------- hierarchy + layout */

export interface MapNode {
  node: TopicNode | null; // null for the synthetic root (the central entity)
  id: string;
  depth: number;
  parent: MapNode | null;
  children: MapNode[];
  value: number;
  /** angle span in [0, 2π] */
  x0: number;
  x1: number;
}

export const ROOT_ID = '__root__';

/**
 * Build the pillar → section → topic → subtopic tree. Nodes whose parent is missing
 * attach to the root so nothing is dropped. Leaves are sized by demand (floored so
 * zero-demand topics stay clickable); parents are the sum of their children.
 */
export function buildTree(nodes: TopicNode[]): { root: MapNode; byId: Map<string, MapNode> } {
  const root: MapNode = { node: null, id: ROOT_ID, depth: 0, parent: null, children: [], value: 0, x0: 0, x1: Math.PI * 2 };
  const byId = new Map<string, MapNode>();
  for (const n of nodes) byId.set(n.id, { node: n, id: n.id, depth: 0, parent: null, children: [], value: 0, x0: 0, x1: 0 });
  for (const m of byId.values()) {
    const p = m.node!.parent ? byId.get(m.node!.parent) : undefined;
    const parent = p && p !== m ? p : root;
    m.parent = parent;
    parent.children.push(m);
  }
  // Guard against cycles: anything not reachable from the root is re-attached to it.
  const reach = new Set<MapNode>();
  const stack: MapNode[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    if (reach.has(cur)) continue;
    reach.add(cur);
    stack.push(...cur.children);
  }
  for (const m of byId.values()) {
    if (reach.has(m)) continue;
    m.parent?.children.splice(m.parent.children.indexOf(m), 1);
    m.parent = root;
    root.children.push(m);
  }

  const size = (m: MapNode, depth: number, seen: Set<MapNode>): number => {
    seen.add(m);
    m.depth = depth;
    m.children = m.children.filter((c) => !seen.has(c));
    if (!m.children.length) {
      m.value = Math.max(1, m.node?.scores.demand ?? 0);
      return m.value;
    }
    m.value = m.children.reduce((s, c) => s + size(c, depth + 1, seen), 0);
    return m.value;
  };
  size(root, 0, new Set());

  const pillarOrder = (m: MapNode) => {
    const code = m.node?.pillarCode ?? '';
    if (code === 'SPINE') return -1;
    const n = Number(code.replace(/^P/, ''));
    return Number.isFinite(n) ? n : 99;
  };
  const sortRec = (m: MapNode) => {
    m.children.sort((a, b) => (m === root ? pillarOrder(a) - pillarOrder(b) : 0) || b.value - a.value || a.id.localeCompare(b.id));
    m.children.forEach(sortRec);
  };
  sortRec(root);

  const lay = (m: MapNode) => {
    let x = m.x0;
    const span = m.x1 - m.x0;
    for (const c of m.children) {
      c.x0 = x;
      c.x1 = x + (m.value > 0 ? (c.value / m.value) * span : 0);
      x = c.x1;
      lay(c);
    }
  };
  lay(root);
  return { root, byId };
}

export function ancestors(m: MapNode): MapNode[] {
  const out: MapNode[] = [];
  let cur: MapNode | null = m;
  while (cur) {
    out.unshift(cur);
    cur = cur.parent;
  }
  return out;
}

export function descendants(m: MapNode): MapNode[] {
  const out: MapNode[] = [];
  const stack = [m];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    for (let i = cur.children.length - 1; i >= 0; i--) stack.push(cur.children[i]);
  }
  return out;
}

/** Arc coordinates relative to a zoom focus: angles rescaled to the full circle, rings shifted. */
export interface ArcPos {
  a0: number;
  a1: number;
  r: number; // ring index, 1 = first ring outside the centre
}

export function arcFor(m: MapNode, focus: MapNode): ArcPos {
  const span = focus.x1 - focus.x0 || 1;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    a0: clamp((m.x0 - focus.x0) / span) * Math.PI * 2,
    a1: clamp((m.x1 - focus.x0) / span) * Math.PI * 2,
    r: m.depth - focus.depth,
  };
}

/** SVG path for an annular sector. Angles in radians clockwise from 12 o'clock. */
export function arcPath(a0: number, a1: number, r0: number, r1: number, pad = 0.002): string {
  const span = a1 - a0;
  if (span <= 0 || r1 <= r0) return '';
  const p = Math.min(pad, span / 4);
  const s = a0 + p;
  const e = a1 - p;
  const full = span >= Math.PI * 2 - 1e-6;
  const pt = (a: number, r: number) => `${(Math.sin(a) * r).toFixed(2)},${(-Math.cos(a) * r).toFixed(2)}`;
  if (full) {
    // Two half-arcs so a full ring renders.
    return [
      `M${pt(0, r1)}`,
      `A${r1},${r1} 0 1 1 ${pt(Math.PI, r1)}`,
      `A${r1},${r1} 0 1 1 ${pt(0, r1)}`,
      `M${pt(0, r0)}`,
      `A${r0},${r0} 0 1 0 ${pt(Math.PI, r0)}`,
      `A${r0},${r0} 0 1 0 ${pt(0, r0)}`,
      'Z',
    ].join(' ');
  }
  const large = e - s > Math.PI ? 1 : 0;
  return [`M${pt(s, r1)}`, `A${r1},${r1} 0 ${large} 1 ${pt(e, r1)}`, `L${pt(e, r0)}`, `A${r0},${r0} 0 ${large} 0 ${pt(s, r0)}`, 'Z'].join(' ');
}

/* ---------------------------------------------------------------- filters */

export interface MapFilters {
  pillar: string | null;
  statuses: TopicStatus[] | null;
  intents: TopicIntent[] | null;
  minPriority: number;
}

export function nodeMatches(n: TopicNode, f: MapFilters): boolean {
  if (f.pillar && n.pillarCode !== f.pillar) return false;
  if (f.statuses && !f.statuses.includes(n.status)) return false;
  if (f.intents && !f.intents.includes(n.intent)) return false;
  if (f.minPriority > 0 && n.scores.priority < f.minPriority) return false;
  return true;
}

export function filtersActive(f: MapFilters): boolean {
  return !!(f.pillar || f.statuses || f.intents || f.minPriority > 0);
}

/**
 * Ids that stay bright: nodes that match, plus their ancestors (so the path to a match
 * stays readable). Null when no filter is active.
 */
export function litIds(byId: Map<string, MapNode>, f: MapFilters): Set<string> | null {
  if (!filtersActive(f)) return null;
  const lit = new Set<string>();
  for (const m of byId.values()) {
    if (!m.node || !nodeMatches(m.node, f)) continue;
    let cur: MapNode | null = m;
    while (cur && !lit.has(cur.id)) {
      lit.add(cur.id);
      cur = cur.parent;
    }
  }
  return lit;
}

/* ---------------------------------------------------------------- URL state */

export interface MapViewState extends MapFilters {
  topic: string | null;
  metric: Metric;
}

const PILLAR_CODE = /^(P[1-9][0-9]?|SPINE)$/;

export function mapViewFromParams(params: URLSearchParams): MapViewState {
  const metric = params.get('metric');
  const topic = params.get('topic');
  const pillar = params.get('pillar');
  const csv = (k: string) => {
    const v = params.get(k);
    return v == null ? null : v.split(',').map((s) => s.trim()).filter(Boolean);
  };
  const statuses = csv('status')?.map((s) => s.toUpperCase().replace(/[_-]/g, ' ')).filter((s): s is TopicStatus => (STATUSES as readonly string[]).includes(s));
  const intents = csv('intent')?.filter((s): s is TopicIntent => (INTENTS as readonly string[]).includes(s));
  const min = Number(params.get('min'));
  return {
    topic: isTopicId(topic) ? topic : null,
    metric: (METRICS as readonly string[]).includes(metric ?? '') ? (metric as Metric) : 'priority',
    pillar: pillar && PILLAR_CODE.test(pillar) ? pillar : null,
    statuses: statuses && statuses.length ? statuses : null,
    intents: intents && intents.length ? intents : null,
    minPriority: Number.isFinite(min) && min > 0 ? Math.min(100, Math.round(min)) : 0,
  };
}

export function mapViewToQuery(v: MapViewState): string {
  const q = new URLSearchParams();
  if (v.topic) q.set('topic', v.topic);
  if (v.metric !== 'priority') q.set('metric', v.metric);
  if (v.pillar) q.set('pillar', v.pillar);
  if (v.statuses) q.set('status', v.statuses.map((s) => s.replace(' ', '_')).join(','));
  if (v.intents) q.set('intent', v.intents.join(','));
  if (v.minPriority > 0) q.set('min', String(v.minPriority));
  return q.toString();
}

/* ---------------------------------------------------------------- plain-words lines */

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** One line per score explaining where the number comes from, for the drill-down panel. */
export function scoreWhy(key: ScoreKey, t: TopicScorecard): string {
  switch (key) {
    case 'demand': {
      const quotes = t.problems.reduce((s, p) => s + (p.quoteCount ?? 0), 0);
      if (!t.queryCount && !quotes) return 'No searches or audience comments point here yet.';
      return `${plural(t.queryCount, 'search phrasing')} and ${plural(quotes, 'audience comment')} point here.`;
    }
    case 'proof': {
      if (!t.claims.length) return 'No claim in the corpus backs this yet.';
      const best = t.claims.reduce<number | null>((m, c) => (c.bestSimilarity == null ? m : Math.max(m ?? 0, c.bestSimilarity)), null);
      return best == null
        ? `${plural(t.claims.length, 'claim')} here, none matched to corpus evidence yet.`
        : `${plural(t.claims.length, 'claim')}; the closest corpus evidence matches at ${best.toFixed(2)} (1.00 is identical).`;
    }
    case 'coverage': {
      if (!t.assets.length) return 'Nothing made on this yet.';
      const count = (s: string) => t.assets.filter((a) => a.status.toUpperCase() === s).length;
      const parts = [
        count('LIVE') && `${count('LIVE')} LIVE`,
        count('BUILT') && `${count('BUILT')} BUILT`,
        count('TO BUILD') && `${count('TO BUILD')} TO BUILD`,
      ].filter(Boolean);
      return `${plural(t.assets.length, 'asset')}: ${parts.join(', ') || 'status unverified'}.`;
    }
    case 'competition': {
      if (!t.competitors.length) return 'No tracked creator covers this. Context only.';
      const top = t.competitors.reduce<number | null>((m, c) => (c.outlier == null ? m : Math.max(m ?? 0, c.outlier)), null);
      return `${plural(t.competitors.length, 'tracked creator')} cover it${top != null ? `; their best video ran ${top.toFixed(1)} times their usual views` : ''}. Context only.`;
    }
    case 'productFit':
      return t.products.length ? `Leads to ${t.products.map((p) => p.label).join(', ')}.` : 'Does not lead to a Rite, the quiz or the beta yet.';
    case 'priority':
      return t.queuePosition != null ? `Number ${t.queuePosition} in the make-next queue. ${whyNow(t)}` : `Not in the make-next queue. ${whyNow(t)}`;
  }
}

type WhyInput = Pick<QueueItem, 'demand' | 'proof' | 'coverage' | 'status'>;

/** The one-line "why now" for a queue row or a topic. */
export function whyNow(item: WhyInput | TopicNode): string {
  const s = 'scores' in item ? { ...item.scores, status: item.status } : item;
  const parts: string[] = [];
  if (s.demand >= 70) parts.push(`people ask about it a lot (demand ${Math.round(s.demand)})`);
  else if (s.demand >= 40) parts.push(`steady demand (${Math.round(s.demand)})`);
  else parts.push(`demand is low (${Math.round(s.demand)})`);

  if (s.status === 'LIVE') parts.push('a LIVE asset already covers it');
  else if (s.status === 'BUILT') parts.push('an asset is BUILT and waiting to ship');
  else if (s.coverage < 30) parts.push('nothing LIVE covers it');
  else parts.push(`partly covered (${Math.round(s.coverage)})`);

  if (s.proof >= 60) parts.push('the corpus already backs it');
  else if (s.proof < 30) parts.push('proof needs work first');

  const line = parts.join(', ');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

export interface MapTotals {
  topics: number;
  byStatus: Record<TopicStatus, number>;
}

/** Counts over topic and subtopic nodes (pillars and sections are structure). */
export function mapTotals(nodes: TopicNode[]): MapTotals {
  const byStatus: Record<TopicStatus, number> = { LIVE: 0, BUILT: 0, 'TO BUILD': 0, NONE: 0 };
  let topics = 0;
  for (const n of nodes) {
    if (n.level !== 'topic' && n.level !== 'subtopic') continue;
    topics++;
    byStatus[n.status] = (byStatus[n.status] ?? 0) + 1;
  }
  return { topics, byStatus };
}

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
