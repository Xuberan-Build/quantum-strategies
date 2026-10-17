/**
 * problem-map: the problem -> mechanism -> solution -> product map, plus the quiz v2 patterns.
 *
 * - §0 table (columns "#", "Cluster", "Merged n", ...): one `problem` per configured row, with counts,
 *   the quiz pattern and the products named in the scan / later-Rite columns (addresses edges).
 * - §2 cluster cards (### headings): `mechanism` ("Mechanism QS names."), `solution_type`
 *   ("Solution category."), explains / solves edges, claim ids in the mechanism -> supports edges,
 *   products named in "Product." -> addresses edges.
 * - §3 tried matrix (columns "Tried", "Claim"): `solution_type` nodes for what people tried, with
 *   contradicts edges from the claims that say why it didn't stick.
 * - Products and Rites come from the config (part_of edges product -> rite).
 * - Quiz spec v2: pattern table (columns "ID", "Scan it routes to") -> routes_to problem -> product for
 *   every problem whose map row names that pattern; Q1 `seg:` options -> quiz `segment` nodes.
 */
import { pillarIdsByCode, type Architecture } from './extract-architecture';
import { readBrain, readBrainJson, type ExtractContext } from './context';
import { nodeId, slugify } from './ids';
import { clean, col, findTable, parseIntLoose, sections, truncate } from './md';
import type { ExtractResult, GraphEdge, GraphNode } from './types';

const CLAIM_ID = /\b([PODM][1-9]|X1[0-5]|X[1-9])\b/g;

export function claimIdsIn(text: string): string[] {
  return [...new Set([...text.matchAll(CLAIM_ID)].map((m) => m[1]))];
}

/** Quoted phrases in a cell or heading: "…", “…” */
export function quotedPhrases(text: string): string[] {
  return [...text.matchAll(/["“]([^"”]{3,})["”]/g)].map((m) => m[1].trim());
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Bold-led fields in a card: "**Mechanism QS names.** text…" -> { 'mechanism qs names': 'text…' } */
export function cardFields(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = body.split(/\n(?=\*\*[^*\n]+?[.:]?\*\*)/);
  for (const part of parts) {
    const m = part.match(/^\*\*([^*\n]+?)[.:]?\*\*\s*([\s\S]*)$/);
    if (m) out[norm(m[1])] = m[2].trim();
  }
  return out;
}

export function productMatcher(ctx: ExtractContext) {
  const entries = ctx.config.products.flatMap((p) => [p.name, ...p.aliases].map((a) => ({ alias: a.toLowerCase(), id: nodeId('product', p.slug) })));
  entries.sort((a, b) => b.alias.length - a.alias.length);
  return (text: string): string[] => {
    let t = text.toLowerCase();
    const found = new Set<string>();
    for (const e of entries) {
      if (t.includes(e.alias)) {
        found.add(e.id);
        t = t.split(e.alias).join(' ');
      }
    }
    return [...found];
  };
}

export function extractProblemMap(ctx: ExtractContext): ExtractResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const findProducts = productMatcher(ctx);
  const arch = readBrainJson<Architecture>(ctx, ctx.config.architecture);
  const pillarByCode = pillarIdsByCode(arch);

  // Rites and products (config)
  for (const r of ctx.config.rites) nodes.push({ id: nodeId('rite', r.slug), type: 'rite', label: r.name, weight: 3, props: { status: r.status ?? null } });
  for (const p of ctx.config.products) {
    const id = nodeId('product', p.slug);
    nodes.push({ id, type: 'product', label: p.name, weight: 2, props: { status: p.status ?? null, rite: p.rite ?? null } });
    if (p.rite) edges.push({ src: id, dst: nodeId('rite', p.rite), type: 'part_of' });
  }

  const mapPath = ctx.config.problem_map;
  const md = readBrain(ctx, mapPath);
  const problemByRow = new Map(ctx.config.problems.map((p) => [p.row, p]));
  const labelToSlug: { phrase: string; slug: string }[] = [];
  const patternRows = new Map<string, string[]>(); // quiz pattern id -> problem slugs

  // Every configured problem gets a node even without the map (labels improve when the map parses).
  const problemNode = (slug: string): GraphNode => {
    let n = nodes.find((x) => x.id === nodeId('problem', slug));
    if (!n) {
      const cfg = ctx.config.problems.find((p) => p.slug === slug);
      n = { id: nodeId('problem', slug), type: 'problem', label: slug.replace(/-/g, ' '), source_path: mapPath, props: { slug, guardrail: !!cfg?.guardrail, codes: cfg?.codes ?? [] } };
      nodes.push(n);
      for (const code of cfg?.pillars ?? []) {
        const pid = pillarByCode.get(code);
        if (pid) edges.push({ src: n.id, dst: pid, type: 'belongs_to_pillar', props: { pillar_code: code } });
        else warnings.push(`problem ${slug}: pillar ${code} not in architecture`);
      }
    }
    return n;
  };
  for (const p of ctx.config.problems) problemNode(p.slug);

  if (!md) {
    warnings.push(`${mapPath} not found`);
  } else {
    // §0 table
    const t = findTable(md, /^#$/, /^cluster/i, /merged/i);
    if (!t) warnings.push('problem map: §0 table (#, Cluster, Merged n) not found');
    else {
      const c = {
        row: col(t, /^#$/),
        cluster: col(t, /^cluster/i),
        merged: col(t, /merged/i),
        yt: col(t, /youtube/i),
        forum: col(t, /forum/i),
        stage: col(t, /stage/i),
        quiz: col(t, /quiz/i),
        scan: col(t, /scan/i),
        later: col(t, /later|rite/i),
      };
      for (const r of t.rows) {
        const rowId = clean(r[c.row] ?? '');
        const cfg = problemByRow.get(rowId);
        if (!cfg) continue;
        const n = problemNode(cfg.slug);
        const cell = r[c.cluster] ?? '';
        const phrases = quotedPhrases(cell.replace(/\([^)]*\)\s*$/, ''));
        const desc = cell.match(/\(([^)]*)\)\s*$/)?.[1] ?? null;
        n.label = phrases.length ? phrases.join(' / ') : truncate(clean(cell), 80);
        n.summary = desc ? clean(desc) : clean(cell);
        const [ytN, ytLikes] = (r[c.yt] ?? '').split('·').map((s) => parseIntLoose(s));
        const [fN, fScore] = (r[c.forum] ?? '').split('·').map((s) => parseIntLoose(s));
        const merged = parseIntLoose(r[c.merged]);
        const quiz = clean(r[c.quiz] ?? '');
        n.weight = Math.max(n.weight ?? 1, merged ?? 1);
        n.props = {
          ...n.props,
          row: rowId,
          merged_n: merged,
          youtube: { n: ytN ?? null, likes: ytLikes ?? null },
          forums: { n: fN ?? null, score: fScore ?? null },
          stage: clean(r[c.stage] ?? ''),
          quiz_pattern_cell: quiz,
          scan_cell: clean(r[c.scan] ?? ''),
          later_rite_cell: clean(r[c.later] ?? ''),
        };
        n.embedText = `${n.label}. ${n.summary ?? ''}`;
        for (const ph of phrases) labelToSlug.push({ phrase: norm(ph), slug: cfg.slug });
        for (const m of quiz.matchAll(/\b([A-Z]{2,}(?:_[A-Z]+)+|SHOULDS|SMALLER)\b/g)) patternRows.set(m[1], [...(patternRows.get(m[1]) ?? []), cfg.slug]);
        for (const pid of findProducts(r[c.scan] ?? '')) edges.push({ src: pid, dst: n.id, type: 'addresses', props: { via: 'map table: scan', later: false } });
        for (const pid of findProducts(r[c.later] ?? '')) edges.push({ src: pid, dst: n.id, type: 'addresses', props: { via: 'map table: later Rite', later: true } });
      }
    }

    // §2 cards
    const cards = sections(md, 3).filter((s) => /^2\.\d+/.test(s.title));
    for (const card of cards) {
      const phrases = quotedPhrases(card.title).map(norm);
      const slugs = [...new Set(labelToSlug.filter((l) => phrases.some((p) => l.phrase.includes(p) || p.includes(l.phrase))).map((l) => l.slug))];
      if (!slugs.length) {
        warnings.push(`card "${truncate(clean(card.title), 60)}" matched no problem row`);
        continue;
      }
      const f = cardFields(card.body);
      const problemIds = slugs.map((s) => nodeId('problem', s));
      const mech = f['mechanism qs names'];
      if (mech) {
        const id = nodeId('mechanism', slugs[0]);
        const text = clean(mech);
        const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
        // X-ids are claims we refuse to make ("No income claims (X4)"); they never support a mechanism.
        const claims = claimIdsIn(mech).filter((c) => !c.startsWith('X'));
        nodes.push({ id, type: 'mechanism', label: truncate(first, 140), summary: truncate(text, 1500), source_path: mapPath, weight: 2, props: { claim_ids: claims, problems: slugs, card: clean(card.title) }, embedText: text });
        for (const pid of problemIds) edges.push({ src: id, dst: pid, type: 'explains' });
        for (const cid of claims) edges.push({ src: nodeId('claim', cid), dst: id, type: 'supports', props: { via: 'map card' } });
      }
      const sol = f['solution category'];
      if (sol) {
        const text = clean(sol);
        const id = nodeId('solution_type', slugs[0]);
        nodes.push({ id, type: 'solution_type', label: truncate(text, 140), summary: f["what won't help"] ? `What won't help: ${clean(f["what won't help"])}` : null, source_path: mapPath, props: { kind: 'qs', problems: slugs } });
        for (const pid of problemIds) edges.push({ src: id, dst: pid, type: 'solves' });
      }
      const prod = f['product'];
      if (prod) {
        for (const pid of findProducts(prod)) {
          const status = ctx.config.products.find((p) => nodeId('product', p.slug) === pid)?.status ?? null;
          for (const prob of problemIds) edges.push({ src: pid, dst: prob, type: 'addresses', props: { via: 'map card', later: status !== 'LIVE' } });
        }
      }
      const words = f['their words'];
      if (words) {
        const quotes = words.split('\n').filter((l) => /^\s*-\s/.test(l)).map((l) => clean(l.replace(/^\s*-\s*/, '')));
        for (const prob of problemIds) {
          const n = nodes.find((x) => x.id === prob);
          if (n) n.props = { ...n.props, their_words: quotes.slice(0, 8) };
        }
      }
    }

    // §3 tried matrix
    const tm = findTable(md, /^tried$/i, /claim/i);
    if (tm) {
      const ct = col(tm, /^tried$/i);
      const cw = col(tm, /their words/i);
      const cq = col(tm, /what qs says/i);
      const cc = col(tm, /claim/i);
      for (const r of tm.rows) {
        const rowText = clean(r[ct] ?? '');
        const bucket = ctx.config.tried.find((b) => b.row && norm(rowText).startsWith(norm(b.row)));
        const id = nodeId('solution_type', `tried-${bucket?.slug ?? slugify(rowText, 40)}`);
        nodes.push({
          id,
          type: 'solution_type',
          label: rowText,
          summary: cq >= 0 ? clean(r[cq] ?? '') : null,
          source_path: mapPath,
          props: { kind: 'tried', why_it_failed: cw >= 0 ? clean(r[cw] ?? '') : null, claim_cell: clean(r[cc] ?? '') },
        });
        for (const cid of claimIdsIn(r[cc] ?? '')) edges.push({ src: nodeId('claim', cid), dst: id, type: 'contradicts', props: { relation: 'why_it_didnt_stick' } });
      }
    }
  }

  // Quiz v2
  const quizPath = ctx.config.quiz_spec;
  const quiz = readBrain(ctx, quizPath);
  if (quiz) {
    const qt = findTable(quiz, /^id$/i, /routes to/i);
    if (!qt) warnings.push('quiz spec: pattern table (ID, Scan it routes to) not found');
    else {
      const ci = col(qt, /^id$/i);
      const cn = col(qt, /working name/i);
      const cr = col(qt, /one-line read/i);
      const cs = col(qt, /routes to/i);
      const cm = col(qt, /merged/i);
      for (const r of qt.rows) {
        const pattern = clean(r[ci] ?? '');
        const products = findProducts(r[cs] ?? '');
        const slugs = patternRows.get(pattern) ?? [];
        if (!slugs.length) warnings.push(`quiz pattern ${pattern} matched no problem row`);
        for (const slug of slugs) {
          const n = problemNode(slug);
          n.props = { ...n.props, quiz_pattern: pattern, quiz_pattern_name: cn >= 0 ? clean(r[cn] ?? '') : null, quiz_read: cr >= 0 ? clean(r[cr] ?? '') : null };
          for (const pid of products) {
            edges.push({ src: n.id, dst: pid, type: 'routes_to', props: { pattern, pattern_name: cn >= 0 ? clean(r[cn] ?? '') : null, merged: cm >= 0 ? clean(r[cm] ?? '') : null } });
          }
        }
      }
    }
    const quizProduct = ctx.config.products.find((p) => /read|quiz/i.test(p.slug));
    const seen = new Set<string>();
    for (const m of quiz.matchAll(/(?:^|·|>)\s*([^·>`\n]{3,90}?)\s*`seg:([a-z_]+)`/gm)) {
      if (seen.has(m[2])) continue;
      seen.add(m[2]);
      const id = nodeId('segment', `quiz-${m[2]}`);
      nodes.push({ id, type: 'segment', label: clean(m[1]), source_path: quizPath, props: { kind: 'quiz', tag: `seg:${m[2]}` } });
      if (quizProduct) edges.push({ src: nodeId('product', quizProduct.slug), dst: id, type: 'mentions', props: { via: 'quiz Q1' } });
    }
  } else warnings.push(`${quizPath} not found`);

  return { nodes, edges, warnings };
}
