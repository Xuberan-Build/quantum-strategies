#!/usr/bin/env tsx
/**
 * Hand a "Make from this" draft to the full content pipeline (/content-run piece:<id>).
 *
 *   npx tsx scripts/content/fetch-piece-for-run.ts <piece-id> <run-folder>
 *
 * READ-ONLY. Loads the piece, its source (made_from), its insight and the research pack saved on
 * content_pieces.platform_meta.research, and writes <run-folder>/from-piece.md for the content-brief
 * agent to start from. Never writes to the database.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions);
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true } as dotenv.DotenvConfigOptions);

const SITE = 'https://quantumstrategies.online';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Meta = Record<string, unknown>;
type Research = {
  topic_id?: string | null;
  topics?: { id: string; title: string; pillar: string; cluster: string | null; matchedBy: string; matchReason: string }[];
  phrases?: string[];
  sources?: { id: string; chunk_id: string; text_name: string | null; author: string | null; section: string | null; tier: string; url: string | null; via: string; claim: string | null; excerpt: string }[];
  claims?: { id: string; label: string; tier: string | null; sources: string[] }[];
  questions?: string[];
  words?: { text: string; source: string | null; url: string | null }[];
  first_hand?: { id: string; text: string; kind: string; where: string; sourceRef: string | null; refId: string | null }[];
  links?: { url: string; label: string; kind: string; status: string }[];
  gaps?: string[];
  counts?: Record<string, number>;
  built_at?: string;
};

async function maybe<T>(q: PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<T | null> {
  try {
    const { data, error } = await q;
    return error ? null : ((data as T) ?? null);
  } catch {
    return null;
  }
}

async function loadSource(sb: SupabaseClient, ref: { kind?: string; id?: string } | undefined): Promise<{ label: string; title: string | null; url: string | null; text: string | null }> {
  if (!ref?.kind || !ref.id) return { label: 'unknown', title: null, url: null, text: null };
  const label = `${ref.kind} ${ref.id}`;
  if (ref.kind === 'external') return { label, title: null, url: ref.id, text: null };
  if (!UUID_RE.test(ref.id)) return { label, title: null, url: null, text: null };
  if (ref.kind === 'article') {
    const r = await maybe<{ slug: string; title: string; excerpt: string | null; body: string | null }>(sb.from('content_posts').select('slug, title, excerpt, body').eq('id', ref.id).maybeSingle());
    return { label, title: r?.title ?? null, url: r?.slug ? `${SITE}/articles/${r.slug}/` : null, text: r ? [r.excerpt, r.body].filter(Boolean).join('\n\n') : null };
  }
  if (ref.kind === 'piece') {
    const r = await maybe<{ title: string | null; body: string | null; piece_type: string }>(sb.from('content_pieces').select('title, body, piece_type').eq('id', ref.id).maybeSingle());
    return { label: `${label} (${r?.piece_type ?? '?'})`, title: r?.title ?? null, url: null, text: r?.body ?? null };
  }
  if (ref.kind === 'social_post') {
    const r = await maybe<{ title: string | null; caption: string | null }>(sb.from('social_posts').select('title, caption').eq('id', ref.id).maybeSingle());
    return { label, title: r?.title ?? null, url: null, text: r?.caption ?? null };
  }
  if (ref.kind === 'insight') {
    const r = await maybe<{ line: string; source_ref: string | null }>(sb.from('content_insights').select('line, source_ref').eq('id', ref.id).maybeSingle());
    return { label, title: r?.line ?? null, url: null, text: r ? `${r.line}${r.source_ref ? `\n\nSource: ${r.source_ref}` : ''}` : null };
  }
  return { label, title: null, url: null, text: null };
}

function fence(text: string): string {
  return ['````text', text.trim(), '````'].join('\n');
}

export function renderFromPiece(input: {
  piece: { id: string; title: string | null; piece_type: string; status: string; body: string | null; notes: string | null; created_at?: string | null };
  meta: Meta;
  source: { label: string; title: string | null; url: string | null; text: string | null };
  insight: { id: string; line: string; source_kind: string | null; source_ref: string | null; claim: string | null; evidence_tier: string | null } | null;
  research: Research | null;
}): string {
  const { piece, meta, source, insight, research } = input;
  const r = research;
  const topics = r?.topics ?? [];
  const L: string[] = [];
  L.push(`# From piece: ${piece.title ?? piece.id}`, '');
  L.push('Written by `scripts/content/fetch-piece-for-run.ts` (read-only). content-brief starts from this file and the matched topic. The draft below is input, not output: the writer still writes `draft.md` from the approved brief. Nothing here is first-hand unless it is listed under "Austin\'s material" with its row.', '');
  L.push('## Header', '');
  L.push(`- Piece: \`${piece.id}\` · ${piece.piece_type} · ${piece.status}`);
  L.push(`- Admin: ${SITE}/admin/studio/social-calendar/${piece.id}`);
  L.push(`- Made from: ${source.label}${source.title ? ` ("${source.title}")` : ''}${source.url ? ` · ${source.url}` : ''}`);
  L.push(`- Direction: ${String(meta.direction ?? 'unknown')} (source form ${String(meta.source_form ?? '?')})`);
  L.push(`- Topic: ${topics.length ? topics.map((t) => `\`${t.id}\` ${t.title} (${t.pillar}; matched by ${t.matchedBy}: ${t.matchReason})`).join('; ') : 'no topic match (content-brief proposes the closest topic and flags it as an open decision)'}`);
  L.push(`- Research pack: ${r ? `built ${r.built_at ?? '?'}; ${r.counts?.sources ?? 0} sources, ${r.counts?.firstHand ?? 0} first-hand items, ${r.counts?.questions ?? 0} audience questions` : 'none saved on this piece'}`);
  L.push('- Corpus search: full-text only in the app (vector search down until the Voyage migration). Read the brain files directly.', '');

  L.push('## Gaps', '');
  const gaps = [...(r?.gaps ?? [])];
  if (!r) gaps.push('No research pack on this piece (made before research packs existed, or a short target).');
  const body = piece.body ?? '';
  const needs = body.match(/\[NEEDS SOURCE\]/g)?.length ?? 0;
  const austin = body.match(/\[AUSTIN:[^\]]*\]/g) ?? [];
  if (needs) gaps.push(`${needs} [NEEDS SOURCE] mark${needs > 1 ? 's' : ''} in the draft.`);
  for (const a of austin) gaps.push(`Draft asks Austin: ${a}`);
  L.push(...(gaps.length ? gaps.map((g) => `- ${g}`) : ['- none recorded']), '');

  if (insight) {
    L.push('## The insight this carries', '');
    L.push(`- \`${insight.id}\`: "${insight.line}"`);
    if (insight.source_ref) L.push(`- Source: ${insight.source_kind ?? 'other'} · ${insight.source_ref}`);
    if (insight.claim) L.push(`- Claim: ${insight.claim}${insight.evidence_tier ? ` (tier ${insight.evidence_tier})` : ''}`);
    L.push('');
  }

  L.push('## Sources (research pack)', '');
  if (r?.sources?.length) {
    L.push('| id | source | tier | via | locator |', '|---|---|---|---|---|');
    for (const s of r.sources) {
      L.push(`| ${s.id} | ${[s.author, s.text_name, s.section].filter(Boolean).join(', ').replace(/\|/g, '/')} | ${s.tier} | ${s.via}${s.claim ? ` (${s.claim.replace(/\|/g, '/')})` : ''} | chunk \`${s.chunk_id}\`${s.url ? ` · ${s.url}` : ''} |`);
    }
    L.push('');
    for (const s of r.sources) L.push(`**${s.id}.** "${s.excerpt}"`, '');
  } else L.push('none', '');
  if (r?.claims?.length) {
    L.push('### Mapped claims', '');
    for (const c of r.claims) L.push(`- \`${c.id}\` ${c.label}${c.tier ? ` (tier ${c.tier})` : ''}: ${c.sources.length ? c.sources.join(', ') : 'no passage loaded'}`);
    L.push('');
  }

  L.push('## Audience questions and words', '');
  for (const q of r?.questions ?? []) L.push(`- Q: ${q}`);
  for (const w of r?.words ?? []) L.push(`- Their words: ${w.text}${w.source ? ` (${w.source})` : ''}${w.url ? ` ${w.url}` : ''}`);
  if (!r?.questions?.length && !r?.words?.length) L.push('- none on file');
  L.push('');

  L.push("## Austin's material (verbatim rows only)", '');
  if (r?.first_hand?.length) for (const a of r.first_hand) L.push(`- **${a.id}** (${a.kind}) "${a.text}" · ${a.where}${a.sourceRef ? ` · ${a.sourceRef}` : ''}${a.refId ? ` · row \`${a.refId}\`` : ''}`);
  else L.push('- none on file: content-experience gathers it from the brain files and asks Austin.');
  const interview = (piece.notes ?? '').match(/From interview [^\n]+/g) ?? [];
  for (const line of interview) if (!r?.first_hand?.some((a) => line.includes(a.text))) L.push(`- (piece notes) ${line}`);
  L.push('');

  L.push('## Internal links (published only)', '');
  if (r?.links?.length) for (const l of r.links) L.push(`- ${l.label} (${l.kind}, ${l.status}): ${l.url}`);
  else L.push('- none found; content-brief checks the live sitemap');
  L.push('');

  L.push('## The draft', '', fence(body || '(empty)'), '');
  if (piece.notes?.trim()) L.push('## Piece notes', '', fence(piece.notes), '');
  if (source.text) L.push('## The source', '', fence(source.text.slice(0, 20000)), '');
  return L.join('\n');
}

async function main() {
  const [pieceId, runFolder] = process.argv.slice(2);
  if (!pieceId || !runFolder || !UUID_RE.test(pieceId)) {
    console.error('Usage: npx tsx scripts/content/fetch-piece-for-run.ts <piece-id (uuid)> <run-folder>');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: piece, error } = await sb.from('content_pieces').select('*').eq('id', pieceId).maybeSingle();
  if (error || !piece) {
    console.error(`Piece not found: ${error?.message ?? pieceId}`);
    process.exit(1);
  }
  const meta = (piece.platform_meta ?? {}) as Meta;
  const madeFrom = meta.made_from as { kind?: string; id?: string } | undefined;
  const source = madeFrom
    ? await loadSource(sb, madeFrom)
    : piece.source_post_id
      ? await loadSource(sb, { kind: 'article', id: piece.source_post_id })
      : { label: 'none recorded', title: null, url: null, text: null };
  const insight = piece.insight_id
    ? await maybe<{ id: string; line: string; source_kind: string | null; source_ref: string | null; claim: string | null; evidence_tier: string | null }>(
        sb.from('content_insights').select('id, line, source_kind, source_ref, claim, evidence_tier').eq('id', piece.insight_id).maybeSingle(),
      )
    : null;
  const research = (meta.research as Research | undefined) ?? null;

  const md = renderFromPiece({ piece, meta, source, insight, research });
  const dir = path.resolve(runFolder);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'from-piece.md');
  fs.writeFileSync(out, md);
  console.log(`Wrote ${out}`);
  console.log(`Topic: ${research?.topic_id ?? 'no topic match'}`);
  console.log(`Gaps: ${(research?.gaps ?? []).length}${research ? '' : ' (no research pack on this piece)'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
