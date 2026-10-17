/**
 * Pull unsynced brain feedback (comments left in /admin/brain on decks, slides, docs and graph nodes)
 * into the brain as an append-only inbox, then mark the rows synced.
 *
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/pull-feedback.ts \
 *     [--brain-dir <dir>] [--dry-run]
 *
 * Writes <brain-dir>/feedback/inbox/<YYYY-MM-DD>.md (today, UTC). One entry per row with
 * the deck/slide or doc path + heading path + quoted text, kind, body and time. Each entry
 * carries a `feedback-id` marker; ids already present in any inbox file (including
 * inbox/processed/) are not written again, so a crash between "append" and "mark synced"
 * never duplicates entries. Only unsynced rows are pulled, so each comment lands once.
 *
 * Database writes: only `brain_feedback.synced_to_brain_at` on the rows it exported.
 * Exit codes: 0 ok (including nothing to pull) · 4 database/IO failure.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  BRAIN_FEEDBACK_TABLE,
  FEEDBACK_COLUMNS,
  formatInboxEntry,
  idsInInbox,
  inboxHeader,
  type BrainFeedbackRow,
  type InboxContext,
} from '../../src/lib/brain/feedback';
import { BRAIN_DOC_INDEX_PATH, DocIndexSchema } from '../../src/lib/brain/snapshot';
import { readLocalDecks } from './lib/publish-decks';
import { downloadText, serviceClient } from './lib/storage';

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dryRun = args.includes('--dry-run');
// --brain-dir, else $BRAIN_DIR (the tick sets it to its worktree), else ./brain (the app root's brain checkout).
const brainDir = path.resolve(opt('--brain-dir') ?? process.env.BRAIN_DIR ?? 'brain');

async function main() {
  if (!existsSync(brainDir)) throw new Error(`brain dir not found: ${brainDir}`);
  const sb = serviceClient();

  const { data, error } = await sb
    .from(BRAIN_FEEDBACK_TABLE)
    .select(FEEDBACK_COLUMNS)
    .is('synced_to_brain_at', null)
    .order('created_at', { ascending: true })
    .limit(500)
    .returns<BrainFeedbackRow[]>();
  if (error) throw new Error(`select: ${error.message}`);
  const rows = data ?? [];
  if (!rows.length) {
    console.log('feedback: nothing new');
    return;
  }

  // Titles for context (best effort).
  const ctx: InboxContext = { deckTitles: {}, slideTitles: {}, docs: {} };
  for (const { deck } of readLocalDecks(path.join(brainDir, 'decks')).decks) {
    ctx.deckTitles![deck.id] = deck.title;
    for (const s of deck.slides) ctx.slideTitles![`${deck.id}/${s.id}`] = s.title;
  }
  try {
    const text = await downloadText(sb, BRAIN_DOC_INDEX_PATH);
    const parsed = text ? DocIndexSchema.safeParse(JSON.parse(text)) : null;
    if (parsed?.success) for (const d of parsed.data.docs) ctx.docs![d.slug] = { title: d.title, path: d.path };
  } catch {
    // titles are optional
  }
  // Graph node labels for comments left in /admin/brain/graph (best effort; kg_nodes may not exist).
  const nodeIds = [...new Set(rows.filter((r) => r.target_type === 'node').map((r) => r.target_id))];
  if (nodeIds.length) {
    const { data: nodes } = await sb.from('kg_nodes').select('id, label, type, source_path').in('id', nodeIds.slice(0, 200));
    ctx.nodes = {};
    for (const n of (nodes ?? []) as { id: string; label: string | null; type: string; source_path: string | null }[]) {
      ctx.nodes[n.id] = { label: n.label ?? n.id, type: n.type, sourcePath: n.source_path };
    }
  }

  const inboxDir = path.join(brainDir, 'feedback', 'inbox');
  // Ids already written: the inbox and inbox/processed/ (where the tick moves logged files).
  const seen = new Set<string>();
  for (const dir of [inboxDir, path.join(inboxDir, 'processed')]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      for (const id of idsInInbox(readFileSync(path.join(dir, name), 'utf8'))) seen.add(id);
    }
  }
  const fresh = rows.filter((r) => !seen.has(r.id));
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(inboxDir, `${date}.md`);
  const body = fresh.map((r) => formatInboxEntry(r, ctx)).join('\n');

  if (dryRun) {
    console.log(`[dry-run] would append ${fresh.length} entr${fresh.length === 1 ? 'y' : 'ies'} to ${file} and mark ${rows.length} row(s) synced`);
    if (body) console.log(body);
    return;
  }

  if (fresh.length) {
    mkdirSync(inboxDir, { recursive: true });
    if (!existsSync(file)) writeFileSync(file, inboxHeader(date));
    appendFileSync(file, body + '\n');
  }

  const ids = rows.map((r) => r.id);
  const { error: updateError } = await sb
    .from(BRAIN_FEEDBACK_TABLE)
    .update({ synced_to_brain_at: new Date().toISOString() })
    .in('id', ids)
    .is('synced_to_brain_at', null);
  if (updateError) throw new Error(`mark synced: ${updateError.message} (entries were written; a re-run will not duplicate them)`);

  console.log(`feedback: ${fresh.length} new entr${fresh.length === 1 ? 'y' : 'ies'} → ${path.relative(brainDir, file)}; ${ids.length} row(s) marked synced`);
}

main().catch((e) => {
  console.error('pull-feedback failed:', e instanceof Error ? e.message : e);
  process.exit(4);
});
