/**
 * records: decisions, principles, decks and docs.
 *
 * - decisions/*.md: numbered bold items ("1. **Title.** body") -> `decision`, decided_in -> the file's note.
 * - journey/decisions.md: "### YYYY-MM-DD: title" blocks -> `decision`, decided_in -> the log entry named
 *   in "**Source:**" (else the decisions note).
 * - feedback/principles.md: "## N. Title" blocks -> `principle`, feedback_on -> each brain note the block cites.
 * - decks/*.json -> `deck`, mentions -> source notes, problems (keywords), pillars (name), products (alias).
 * - docs.json manifest -> `doc` (same slug as /admin/brain/docs), mentions -> its note and the problems
 *   its text names (at least two keyword hits).
 */
import path from 'node:path';
import { docSlug } from '../../../../src/lib/brain/archive';
import { listBrainFiles, readBrain, readBrainJson, type ExtractContext } from './context';
import { pillarIdsByCode, type Architecture } from './extract-architecture';
import { productMatcher } from './extract-problem-map';
import { docId, nodeId, noteId, slugify } from './ids';
import { clean, extractLinks, firstParagraph, h1, keywordMatchers, sections, truncate } from './md';
import type { ExtractResult, GraphEdge, GraphNode } from './types';

interface DeckJson {
  id: string;
  title: string;
  summary?: string;
  period?: string;
  status?: string;
  tags?: string[];
  source?: string;
  externalUrl?: string;
  createdAt?: string;
  slides?: { title?: string; subtitle?: string; body?: string; sources?: string[]; [k: string]: unknown }[];
}

/** Count keyword hits per problem in a text. */
export function problemHits(ctx: ExtractContext, text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of ctx.config.problems) {
    let hits = 0;
    for (const re of keywordMatchers(p.keywords)) hits += (text.match(new RegExp(re.source, 'gi')) ?? []).length;
    if (hits) out.set(nodeId('problem', p.slug), hits);
  }
  return out;
}

/** docs.json patterns -> brain paths ('*' matches file names within one folder). */
export function expandManifest(ctx: ExtractContext, patterns: string[]): string[] {
  const all = listBrainFiles(ctx, '.md');
  const out: string[] = [];
  for (const pat of patterns) {
    if (!pat.includes('*')) {
      if (all.includes(pat)) out.push(pat);
      continue;
    }
    const re = new RegExp(`^${pat.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
    out.push(...all.filter((f) => re.test(f)));
  }
  return [...new Set(out)];
}

export function extractRecords(ctx: ExtractContext): ExtractResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const allMd = new Set(listBrainFiles(ctx, '.md'));
  const citedNotes = (text: string, from: string): string[] => {
    const out = new Set<string>();
    for (const l of extractLinks(text)) {
      const t = l.target.replace(/^brain\//, '');
      const cands = [t, path.posix.normalize(path.posix.join(path.posix.dirname(from), t))];
      const hit = cands.find((c) => allMd.has(c));
      if (hit && hit !== from) out.add(hit);
    }
    return [...out];
  };

  // Founder decision files
  for (const rel of listBrainFiles(ctx, '.md', 'decisions')) {
    const md = readBrain(ctx, rel) ?? '';
    const stem = path.posix.basename(rel, '.md');
    const date = stem.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
    for (const m of md.matchAll(/^(\d+)\.\s+\*\*([^*]+?)\.?\*\*\s*([\s\S]*?)(?=^\d+\.\s+\*\*|^#{1,6}\s|(?![\s\S]))/gm)) {
      const id = nodeId('decision', `${stem}-${m[1]}`);
      nodes.push({ id, type: 'decision', label: clean(m[2]), summary: truncate(clean(m[3]), 1200), source_path: rel, weight: 2, props: { date, number: Number(m[1]), canon: true } });
      edges.push({ src: id, dst: noteId(rel), type: 'decided_in' });
    }
  }

  // Journey decision log
  const logRel = 'journey/decisions.md';
  const log = readBrain(ctx, logRel);
  if (log) {
    for (const s of sections(log, 3)) {
      const m = s.title.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
      if (!m) continue;
      const field = (name: string) => s.body.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([^\\n]+)`, 'i'))?.[1] ?? null;
      const id = nodeId('decision', `${m[1]}-${slugify(m[2], 70)}`);
      const why = field('Why');
      const outcome = field('Outcome');
      const source = field('Source');
      nodes.push({ id, type: 'decision', label: clean(m[2]), summary: why ? truncate(clean(why), 1200) : null, source_path: logRel, props: { date: m[1], outcome: outcome ? truncate(clean(outcome), 600) : null, rejected: field('Rejected') ? truncate(clean(field('Rejected')!), 600) : null, source } });
      const targets = new Set<string>();
      for (const sm of (source ?? '').matchAll(/((?:journey\/)?log\/[A-Za-z0-9_.-]+\.md)/g)) {
        const p = sm[1].startsWith('journey/') ? sm[1] : `journey/${sm[1]}`;
        if (allMd.has(p)) targets.add(p);
      }
      if (!targets.size) targets.add(logRel);
      for (const t of targets) edges.push({ src: id, dst: noteId(t), type: 'decided_in' });
    }
  }

  // Principles
  const prRel = 'feedback/principles.md';
  const pr = readBrain(ctx, prRel);
  if (pr) {
    for (const s of sections(pr, 2)) {
      const m = s.title.match(/^(\d+)\.\s+(.+)$/);
      if (!m) continue;
      const id = nodeId('principle', slugify(m[2], 70));
      const fids = [...new Set([...s.body.matchAll(/\b(F-\d{3})\b/g)].map((x) => x[1]))];
      nodes.push({ id, type: 'principle', label: clean(m[2]), summary: firstParagraph(s.body), source_path: prRel, weight: Math.max(1, 4 - Number(m[1]) / 6), props: { rank: Number(m[1]), feedback_ids: fids } });
      const cited = citedNotes(s.body, prRel);
      for (const n of cited.length ? cited : [prRel]) edges.push({ src: id, dst: noteId(n), type: 'feedback_on' });
    }
  }

  // Pillar name matchers (for decks)
  const arch = readBrainJson<Architecture>(ctx, ctx.config.architecture);
  const pillarNames = [...(arch?.pillars ?? [])].map((p) => ({ id: pillarIdsByCode(arch).get(p.id)!, name: p.name.toLowerCase() }));
  const findProducts = productMatcher(ctx);

  // Decks
  for (const rel of listBrainFiles(ctx, '.json', 'decks')) {
    let deck: DeckJson;
    try {
      deck = readBrainJson<DeckJson>(ctx, rel)!;
    } catch {
      warnings.push(`${rel}: invalid JSON`);
      continue;
    }
    if (!deck?.id || !deck.title) continue;
    const id = nodeId('deck', deck.id);
    const slides = deck.slides ?? [];
    nodes.push({
      id,
      type: 'deck',
      label: deck.title,
      summary: deck.summary ?? null,
      source_path: rel,
      url: deck.externalUrl ?? null,
      weight: 1 + slides.length / 4,
      props: { deck_id: deck.id, period: deck.period ?? null, status: deck.status ?? 'current', tags: deck.tags ?? [], slides: slides.length, created_at: deck.createdAt ?? null },
    });
    const text = JSON.stringify(deck);
    const sources = new Set<string>([deck.source ?? '', ...slides.flatMap((s) => s.sources ?? [])].map((s) => s.replace(/^brain\//, '').replace(/#.*$/, '')).filter((s) => allMd.has(s)));
    for (const s of sources) edges.push({ src: id, dst: noteId(s), type: 'mentions', props: { via: 'sources' } });
    for (const [pid, hits] of problemHits(ctx, text)) edges.push({ src: id, dst: pid, type: 'mentions', weight: Math.min(5, hits), props: { via: 'keywords', hits } });
    const lower = text.toLowerCase();
    for (const p of pillarNames) if (p.id && lower.includes(p.name)) edges.push({ src: id, dst: p.id, type: 'mentions', props: { via: 'pillar name' } });
    for (const pid of findProducts(text)) edges.push({ src: id, dst: pid, type: 'mentions', props: { via: 'product name' } });
  }

  // Docs
  const manifest = readBrainJson<{ docs?: string[] }>(ctx, 'docs.json');
  for (const rel of expandManifest(ctx, manifest?.docs ?? [])) {
    const md = readBrain(ctx, rel) ?? '';
    const id = docId(rel);
    nodes.push({ id, type: 'doc', label: h1(md) ?? path.posix.basename(rel, '.md'), summary: firstParagraph(md), source_path: rel, props: { slug: docSlug(rel) } });
    edges.push({ src: id, dst: noteId(rel), type: 'mentions', props: { via: 'publishes' } });
    for (const [pid, hits] of problemHits(ctx, md)) if (hits >= 2) edges.push({ src: id, dst: pid, type: 'mentions', weight: Math.min(5, hits / 2), props: { via: 'keywords', hits } });
  }

  return { nodes, edges, warnings };
}
