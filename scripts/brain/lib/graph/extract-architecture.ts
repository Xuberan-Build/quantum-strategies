/**
 * architecture: content/architecture.json -> pillar / sub_pillar / cluster / cornerstone / spoke, with
 * part_of edges up the tree. Cornerstones and spokes mention the claims named in their `source`
 * ("claims P1, P2") and the problems whose keywords match their title + cluster misbelief.
 */
import { readBrainJson, type ExtractContext } from './context';
import { nodeId } from './ids';
import { keywordMatchers, matchesAny } from './md';
import type { ExtractResult, GraphEdge, GraphNode } from './types';

interface Piece {
  id: string;
  title: string;
  format?: string;
  stage?: string;
  cta?: string;
  cta_label?: string;
  tier?: string;
  status?: string;
  source?: string | null;
  location?: string | null;
  misbelief?: string;
  wave?: number;
  score?: { total?: number };
}
interface Cluster {
  id: string;
  name: string;
  misbelief?: string;
  domains?: string[];
  angle?: string;
  cornerstone?: Piece | null;
  spokes?: Piece[];
}
interface SubPillar {
  id: string;
  name: string;
  clusters?: Cluster[];
}
interface Pillar {
  id: string;
  slug: string;
  name: string;
  kind?: string;
  law?: string;
  job?: string;
  pov?: string;
  misbelief?: string;
  enemy_head?: string;
  product?: string;
  hub?: string;
  hub_status?: string;
  wave?: number;
  subpillars?: SubPillar[];
}
export interface Architecture {
  pillars?: Pillar[];
  spine?: Pillar;
}

/** Pillar code (P1, X) -> node id. Used by other extractors to resolve config pillar codes. */
export function pillarIdsByCode(arch: Architecture | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of [...(arch?.pillars ?? []), ...(arch?.spine ? [arch.spine] : [])]) m.set(p.id, nodeId('pillar', p.slug));
  return m;
}

/** Claim ids cited in a piece's source line, e.g. "Roadmap C1 · claims P1, P2" -> [P1, P2]. */
export function claimRefs(source: string | null | undefined): string[] {
  if (!source) return [];
  const m = source.match(/claims?\s+([A-Z]\d{1,2}(?:\s*(?:,|and|&|\/)\s*[A-Z]\d{1,2})*)/i);
  if (!m) return [];
  return [...new Set(m[1].split(/\s*(?:,|and|&|\/)\s*/).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]\d{1,2}$/.test(s)))];
}

export function extractArchitecture(ctx: ExtractContext): ExtractResult {
  const arch = readBrainJson<Architecture>(ctx, ctx.config.architecture);
  if (!arch) return { nodes: [], edges: [], warnings: [`${ctx.config.architecture} not found`] };
  const src = ctx.config.architecture;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const problemMatchers = ctx.config.problems.map((p) => ({ id: nodeId('problem', p.slug), res: keywordMatchers(p.keywords) }));

  const piece = (p: Piece, role: 'cornerstone' | 'spoke', parent: string, cluster: Cluster) => {
    const id = nodeId(role, p.id);
    nodes.push({
      id,
      type: role,
      label: p.title,
      summary: p.misbelief ? `Misbelief: ${p.misbelief}` : null,
      source_path: p.location?.replace(/^brain\//, '') ?? src,
      weight: p.score?.total ? Math.max(1, p.score.total / 10) : 1,
      tier: p.tier ?? null,
      props: { code: p.id, format: p.format, stage: p.stage, cta: p.cta, cta_label: p.cta_label, status: p.status, wave: p.wave, source: p.source ?? null, location: p.location ?? null },
    });
    edges.push({ src: id, dst: parent, type: 'part_of' });
    for (const c of claimRefs(p.source)) edges.push({ src: id, dst: nodeId('claim', c), type: 'mentions', props: { via: 'source' } });
    const text = `${p.title} ${p.misbelief ?? ''} ${cluster.name}`;
    for (const pm of problemMatchers) if (matchesAny(text, pm.res)) edges.push({ src: id, dst: pm.id, type: 'mentions', props: { via: 'keywords' } });
  };

  for (const p of [...(arch.pillars ?? []), ...(arch.spine ? [arch.spine] : [])]) {
    const pid = nodeId('pillar', p.slug);
    nodes.push({
      id: pid,
      type: 'pillar',
      label: p.name,
      summary: p.job ?? null,
      source_path: src,
      weight: 3,
      props: { code: p.id, slug: p.slug, kind: p.kind, law: p.law, pov: p.pov, misbelief: p.misbelief, enemy: p.enemy_head, product: p.product, hub: p.hub, hub_status: p.hub_status, wave: p.wave },
    });
    for (const sp of p.subpillars ?? []) {
      const sid = nodeId('sub_pillar', sp.id);
      nodes.push({ id: sid, type: 'sub_pillar', label: sp.name, source_path: src, weight: 2, props: { code: sp.id, pillar: p.id } });
      edges.push({ src: sid, dst: pid, type: 'part_of' });
      for (const c of sp.clusters ?? []) {
        const cid = nodeId('cluster', c.id);
        nodes.push({
          id: cid,
          type: 'cluster',
          label: c.name,
          summary: c.angle ?? null,
          source_path: src,
          weight: 1 + (c.spokes?.length ?? 0) / 4,
          props: { code: c.id, misbelief: c.misbelief, domains: c.domains ?? [], pillar: p.id, sub_pillar: sp.id },
        });
        edges.push({ src: cid, dst: sid, type: 'part_of' });
        if (c.cornerstone) piece(c.cornerstone, 'cornerstone', cid, c);
        for (const s of c.spokes ?? []) piece(s, 'spoke', cid, c);
      }
    }
  }
  return { nodes, edges };
}
