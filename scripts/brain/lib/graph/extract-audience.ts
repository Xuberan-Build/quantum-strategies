/**
 * audience: coded public problem statements -> quote / problem / source / community / creator /
 * segment nodes, with voices (quote -> problem), from_source (quote -> source), in_community
 * (quote -> community) and mentions (quote -> what they tried) edges.
 *
 * Inputs (config.audience): youtube ({meta.videos, comments}), forum ({items}) and reddit ({items}) JSON.
 * Codes merge into problems via config.problems[].codes; unknown codes become their own problem
 * (props.clustered = false). No usernames are read or stored; quotes are the coded excerpts only.
 */
import { codeIndex, normCode, triedBucket } from './config';
import { readBrainJson, type ExtractContext } from './context';
import { nodeId, shortHash, slugify } from './ids';
import { truncate } from './md';
import type { ExtractResult, GraphEdge, GraphNode } from './types';

interface YtVideo { video_id: string; channel?: string; title?: string; views_at_search?: number; query?: string }
interface YtComment { video_id: string; likes?: number; codes?: string[]; stage?: string; tried?: string[]; quote_excerpt: string }
interface ForumItem {
  source?: string;
  sub?: string;
  community?: string;
  community_type?: string;
  kind?: string;
  url?: string;
  score?: number;
  thread_points?: number;
  codes?: string[];
  stage?: string;
  tried?: string[];
  quote_excerpt: string;
  verified_exact?: boolean;
}

const STAGES: Record<string, string> = { U: 'unaware', P: 'problem-aware', S: 'solution-aware', PR: 'product-aware' };
const stageOf = (s?: string) => (s ? (STAGES[s] ?? s) : null);

/** Normalise a forum `sub` label: "Ask HN (post)" -> "Ask HN", "Goodreads: The Secret (1*)" -> "Goodreads: The Secret". */
export function communityName(sub: string): string {
  return sub.replace(/\s*\((?:post|comment|\d\*)\)\s*$/i, '').replace(/\s*\([^)]*thread\)\s*$/i, '').trim();
}

/** Code descriptions from any codebook shape: {CODE: desc}, [code], or "CODE (desc), CODE2 (desc)" prose. */
export function codebookLabels(meta: Record<string, unknown> | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!meta) return out;
  const cb = meta.codebook;
  if (cb && typeof cb === 'object' && !Array.isArray(cb)) for (const [k, v] of Object.entries(cb)) out.set(normCode(k), String(v).replace(/^NEW:\s*/i, ''));
  if (Array.isArray(cb)) for (const k of cb) out.set(normCode(String(k)), normCode(String(k)).replace(/_/g, ' '));
  const note = typeof meta.codebook_note === 'string' ? meta.codebook_note : '';
  for (const m of note.matchAll(/\b([A-Z]{2,})\s*\(([^)]+)\)/g)) out.set(m[1], m[2]);
  return out;
}

export function extractAudience(ctx: ExtractContext): ExtractResult {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const byCode = codeIndex(ctx.config);
  const labels = new Map<string, string>();
  const problemStats = new Map<string, { quotes: number; likes: number; score: number; stages: Record<string, number> }>();

  const put = (n: GraphNode) => {
    if (!nodes.has(n.id)) nodes.set(n.id, n);
  };
  const bump = (id: string, by = 1) => {
    const n = nodes.get(id);
    if (n) n.weight = (n.weight ?? 0) + by;
  };

  const problemFor = (code: string): string => {
    const c = normCode(code);
    const slug = byCode.get(c);
    if (slug) return nodeId('problem', slug);
    const id = nodeId('problem', `code-${slugify(c, 40)}`);
    if (!nodes.has(id)) nodes.set(id, { id, type: 'problem', label: labels.get(c) ?? c.replace(/_/g, ' '), weight: 0, props: { slug: `code-${slugify(c, 40)}`, codes: [c], clustered: false } });
    return id;
  };

  const quote = (q: {
    prefix: string;
    key: string;
    excerpt: string;
    weight: number;
    codes: string[];
    stage: string | null;
    tried: string[];
    kind: string;
    sourceId: string;
    communityId: string;
    sourcePath: string;
    url?: string | null;
    extra?: Record<string, unknown>;
  }) => {
    const id = nodeId('quote', `${q.prefix}-${shortHash(q.key, q.excerpt)}`);
    if (nodes.has(id)) return;
    nodes.set(id, {
      id,
      type: 'quote',
      label: truncate(q.excerpt, 120),
      summary: q.excerpt,
      source_path: q.sourcePath,
      url: q.url ?? null,
      weight: Math.max(1, q.weight),
      // props.text / props.likes are what the admin graph UI reads (likes = YouTube likes or forum/Reddit score).
      props: { text: q.excerpt, likes: q.weight, stage: q.stage, tried: q.tried, codes: q.codes, source_kind: q.kind, ...q.extra },
    });
    edges.push({ src: id, dst: q.sourceId, type: 'from_source' });
    edges.push({ src: id, dst: q.communityId, type: 'in_community' });
    bump(q.sourceId);
    bump(q.communityId);
    const probs = [...new Set(q.codes.map(problemFor))];
    for (const p of probs) {
      edges.push({ src: id, dst: p, type: 'voices', weight: Math.max(1, Math.log10(1 + q.weight)), props: { codes: q.codes.filter((c) => problemFor(c) === p) } });
      const s = problemStats.get(p) ?? { quotes: 0, likes: 0, score: 0, stages: {} };
      s.quotes++;
      if (q.kind === 'youtube') s.likes += q.weight;
      else s.score += q.weight;
      if (q.stage) s.stages[q.stage] = (s.stages[q.stage] ?? 0) + 1;
      problemStats.set(p, s);
    }
    for (const t of q.tried) {
      const bucket = triedBucket(ctx.config, t);
      if (!bucket) continue;
      const sid = nodeId('solution_type', `tried-${bucket}`);
      if (!nodes.has(sid)) nodes.set(sid, { id: sid, type: 'solution_type', label: bucket.replace(/-/g, ' '), weight: 0, props: { kind: 'tried' } });
      bump(sid);
      edges.push({ src: id, dst: sid, type: 'mentions', props: { tried: t } });
    }
  };

  for (const file of ctx.config.audience) {
    const data = readBrainJson<{ meta?: Record<string, unknown>; comments?: YtComment[]; items?: ForumItem[] }>(ctx, file.path);
    if (!data) {
      warnings.push(`${file.path} not found`);
      continue;
    }
    for (const [k, v] of codebookLabels(data.meta)) if (!labels.has(k)) labels.set(k, v);

    if (file.kind === 'youtube') {
      const videos = new Map(((data.meta?.videos as YtVideo[]) ?? []).map((v) => [v.video_id, v]));
      for (const c of data.comments ?? []) {
        const v = videos.get(c.video_id);
        const channel = v?.channel?.trim() || 'unknown channel';
        const creatorId = nodeId('creator', slugify(channel, 60));
        const sourceId = nodeId('source', `yt-${c.video_id}`);
        const communityId = nodeId('community', `yt-${slugify(channel, 60)}`);
        if (!nodes.has(creatorId)) put({ id: creatorId, type: 'creator', label: channel, weight: 0, props: { platform: 'youtube' } });
        if (!nodes.has(sourceId)) {
          put({ id: sourceId, type: 'source', label: v?.title ?? `YouTube video ${c.video_id}`, url: `https://www.youtube.com/watch?v=${c.video_id}`, source_path: file.path, weight: 0, props: { kind: 'video', platform: 'youtube', channel, views: v?.views_at_search ?? null, query: v?.query ?? null } });
          edges.push({ src: sourceId, dst: creatorId, type: 'part_of' });
          bump(creatorId);
        }
        if (!nodes.has(communityId)) {
          put({ id: communityId, type: 'community', label: `${channel} (YouTube comments)`, weight: 0, props: { platform: 'youtube' } });
          edges.push({ src: communityId, dst: creatorId, type: 'part_of' });
        }
        quote({
          prefix: 'yt', key: c.video_id, excerpt: c.quote_excerpt, weight: c.likes ?? 0, codes: c.codes ?? [], stage: stageOf(c.stage), tried: c.tried ?? [],
          kind: 'youtube', sourceId, communityId, sourcePath: file.path, url: `https://www.youtube.com/watch?v=${c.video_id}`, extra: { likes: c.likes ?? 0 },
        });
      }
    } else {
      for (const it of data.items ?? []) {
        const platform = file.kind === 'reddit' ? 'reddit' : (it.source ?? 'forum');
        const commName = file.kind === 'reddit' ? `r/${it.sub ?? 'unknown'}` : communityName(it.sub ?? platform);
        const communityId = nodeId('community', `${slugify(platform, 20)}-${slugify(commName.replace(/^r\//, ''), 60)}`);
        const segName = it.community_type ?? it.community ?? null;
        if (!nodes.has(communityId)) {
          put({ id: communityId, type: 'community', label: commName, weight: 0, props: { platform } });
          if (segName) {
            const segId = nodeId('segment', `research-${slugify(segName, 60)}`);
            if (!nodes.has(segId)) put({ id: segId, type: 'segment', label: segName.replace(/_/g, ' '), weight: 1, props: { kind: 'research' } });
            edges.push({ src: communityId, dst: segId, type: 'part_of' });
          }
        }
        const url = it.url ?? null;
        const threadUrl = url ? url.replace(/[?#].*$/, '') : null;
        const sourceId = nodeId('source', `${file.kind === 'reddit' ? 'rd' : 'fm'}-${shortHash(threadUrl ?? `${commName}:${it.quote_excerpt}`)}`);
        if (!nodes.has(sourceId)) {
          put({ id: sourceId, type: 'source', label: `${commName} ${it.kind ?? 'thread'}`, url, source_path: file.path, weight: 0, props: { kind: 'thread', platform, points: it.thread_points ?? it.score ?? null } });
          edges.push({ src: sourceId, dst: communityId, type: 'part_of' });
        }
        quote({
          prefix: file.kind === 'reddit' ? 'rd' : 'fm', key: threadUrl ?? commName, excerpt: it.quote_excerpt, weight: it.score ?? 0, codes: it.codes ?? [],
          stage: stageOf(it.stage), tried: it.tried ?? [], kind: file.kind, sourceId, communityId, sourcePath: file.path, url,
          extra: { score: it.score ?? null, verified_exact: it.verified_exact ?? null },
        });
      }
    }
  }

  // Problem stats (merged into the problem-map's problem nodes by id).
  for (const [id, s] of problemStats) {
    const n = nodes.get(id) ?? { id, type: 'problem' as const, label: id.slice('problem:'.length).replace(/-/g, ' ') };
    n.weight = Math.max(n.weight ?? 0, s.quotes);
    n.props = { ...(n.props ?? {}), quote_count: s.quotes, youtube_likes: s.likes, forum_score: s.score, stages: s.stages };
    nodes.set(id, n);
  }
  for (const n of nodes.values()) if ((n.weight ?? 0) < 1) n.weight = 1;
  return { nodes: [...nodes.values()], edges, warnings };
}
