#!/usr/bin/env tsx
/**
 * Build one interview brief per article for Cowork interview sessions (read-only on the DB).
 *
 *   npx tsx scripts/content/build-interview-briefs.ts [slug ...]
 *
 * Writes brain/content/interviews/<slug>/brief.md: what the article says, every open [AUSTIN: ...] gap
 * and needs_austin piece in the calendar (grouped, with the pieces each one blocks), the run folder's
 * unanswered questions, what Austin has already answered (so it isn't asked again), and the article's research
 * pack (topic claims with sources, lineage, audience questions) for the mentor-style sessions to teach from.
 * Re-run any time; it overwrites brief.md only. Session notes and insights are never touched.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { buildResearchPack, researchBlock } from '../../src/lib/content/any-to-any/research';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const RUNS = path.resolve('brain/content/pipeline/runs');
const OUT = path.resolve('brain/content/interviews');
const SITE = 'https://quantumstrategies.online';

// Corrections Austin has raised in chat that every relevant interview should pick up
const STANDING: Record<string, string[]> = {
  'reticular-activating-system': [
    'Austin said (31 Oct) his snowboarding statement "wasn\'t applied correctly" in these pieces, though "it makes the point". Ask him to say the snowboarding story and the lesson his way, then read it back.',
  ],
};

function runFolderFor(slug: string): string | null {
  for (const d of fs.readdirSync(RUNS)) {
    const s = path.join(RUNS, d, 'status.json');
    const draft = path.join(RUNS, d, 'draft.md');
    if (!fs.existsSync(s)) continue;
    const txt = fs.readFileSync(s, 'utf8') + (fs.existsSync(draft) ? fs.readFileSync(draft, 'utf8').slice(0, 3000) : '');
    if (txt.includes(`/articles/${slug}`) || txt.includes(`"slug": "${slug}"`) || txt.includes(`slug: ${slug}`)) return path.join(RUNS, d);
  }
  return null;
}

const RUN_BY_SLUG: Record<string, string> = {
  'reticular-activating-system': '2026-10-18-ras-myth-attentional-set',
  'baader-meinhof-phenomenon': '2026-10-18-baader-meinhof-phenomenon',
  'selective-attention': '2026-10-18-selective-attention-gorilla-test',
  'manifestation-vision-board': '2026-10-18-vision-boards-attention',
  'self-image': '2026-10-18-self-image-decides-noticing',
  'confirmation-bias': '2026-10-18-you-see-what-you-predict',
};

function read(p: string | null): string {
  return p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: pieces, error } = await supabase
    .from('content_pieces')
    .select('id, title, piece_type, scheduled_for, body, platform_meta, source_post_id, source:content_posts!content_pieces_source_post_id_fkey(slug, title, body)')
    .not('source_post_id', 'is', null)
    .order('scheduled_for');
  if (error) throw error;

  const want = new Set(process.argv.slice(2));
  const bySlug = new Map<string, any[]>();
  for (const p of pieces ?? []) {
    const slug = (p as any).source.slug as string;
    if (want.size && !want.has(slug)) continue;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), p]);
  }

  for (const [slug, list] of bySlug) {
    const source = list[0].source as { title: string; body: string };
    const run = RUN_BY_SLUG[slug] ? path.join(RUNS, RUN_BY_SLUG[slug]) : runFolderFor(slug);

    // Group gaps by their text so one answer can fill several pieces
    const gaps = new Map<string, { pieces: string[] }>();
    const needs: string[] = [];
    for (const p of list) {
      const label = `${p.scheduled_for ?? 'unscheduled'} · ${p.piece_type} · ${p.title} (${SITE}/admin/studio/social-calendar/${p.id})`;
      const found = [...(p.body ?? '').matchAll(/\[AUSTIN:([^\]]*)\]/g)].map((m) => m[1].trim());
      for (const g of found) {
        const e = gaps.get(g) ?? { pieces: [] };
        if (!e.pieces.includes(label)) e.pieces.push(label);
        gaps.set(g, e);
      }
      if (!found.length && p.platform_meta?.needs_austin) needs.push(label);
    }
    const ranked = [...gaps.entries()].sort((a, b) => b[1].pieces.length - a[1].pieces.length);

    const intro = source.body.split(/\n\n+/).filter((x) => x.trim() && !x.startsWith('#')).slice(0, 3).join('\n\n');
    const questions = read(run && path.join(run, 'questions-for-austin.md'));
    const input = read(run && path.join(run, 'input.md'));

    // Research the mentor can teach from (same pack "make from this" builds when going longer)
    let research = '';
    try {
      const pack = await buildResearchPack(supabase, {
        source: { form: 'article', title: source.title, text: source.body, sourcePostId: list[0].source_post_id, articleUrl: `${SITE}/articles/${slug}` },
        target: 'blog',
        maxEvidence: 10,
      });
      research = researchBlock(pack);
    } catch (e) {
      research = `_Research pack failed: ${(e as Error).message}_`;
    }

    const md = [
      `# Interview brief: ${source.title}`,
      '',
      `Generated ${new Date().toISOString().slice(0, 10)} by scripts/content/build-interview-briefs.ts. Re-run it to refresh. Article: ${SITE}/articles/${slug}`,
      run ? `Run folder: brain/content/pipeline/runs/${path.basename(run)}` : 'Run folder: none found',
      '',
      '## What the article says (opening)',
      '',
      intro,
      '',
      ...(STANDING[slug]?.length ? ['## Corrections Austin raised', '', ...STANDING[slug].map((s) => `- ${s}`), ''] : []),
      `## Open gaps in the calendar (${ranked.length}), most-blocking first`,
      '',
      ...ranked.flatMap(([g, e], i) => [`${i + 1}. **${g}**`, ...e.pieces.map((p) => `   - blocks: ${p}`), '']),
      ...(needs.length ? ['## Pieces marked as needing Austin (no placeholder text)', '', ...needs.map((n) => `- ${n}`), ''] : []),
      '## Questions already written for this article',
      '',
      questions ? questions.replace(/^# .*\n/, '') : '_None on file._',
      '',
      '## What the research says (for the mentor to teach from; cite the S# source when you bring it in)',
      '',
      research || '_No research pack._',
      '',
      '## Already answered (do not ask again, build on it)',
      '',
      input ? input.replace(/^# .*\n/, '') : '_Nothing on file yet._',
      '',
    ].join('\n');

    const dir = path.join(OUT, slug);
    fs.mkdirSync(path.join(dir, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'brief.md'), md);
    console.log(`${slug}: ${ranked.length} gaps, ${needs.length} other pieces -> ${path.relative(process.cwd(), dir)}/brief.md`);
  }
}

main();
