/**
 * Brain feedback: Austin's comments on decks, slides and brain docs, stored in the
 * `brain_feedback` table (service role only, behind the admin check). The brain tick
 * pulls unsynced rows into brain/feedback/inbox/<date>.md; Claude edits the brain and
 * replies with scripts/brain/reply-feedback.ts.
 *
 * Pure module: schemas, types, the inbox formatter and data helpers that take a client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SAFE_ID } from './archive';

export const BRAIN_FEEDBACK_TABLE = 'brain_feedback';

export const FEEDBACK_KINDS = ['agree', 'change', 'question', 'idea'] as const;
export const FEEDBACK_STATUSES = ['open', 'answered', 'applied', 'resolved', 'dismissed'] as const;
export const FEEDBACK_TARGETS = ['deck', 'slide', 'doc'] as const;

export const FeedbackKindSchema = z.enum(FEEDBACK_KINDS);
export const FeedbackStatusSchema = z.enum(FEEDBACK_STATUSES);
export const FeedbackTargetSchema = z.enum(FEEDBACK_TARGETS);

export const FeedbackAnchorSchema = z.object({
  headingPath: z.array(z.string().max(300)).max(10),
  quote: z.string().max(1500).optional(),
  versionHash: z.string().max(80).optional(),
  blockId: z.string().max(200).optional(),
  docPath: z.string().max(300).optional(), // brain-relative path of the doc
});

const Id = z.string().min(1).max(160).regex(SAFE_ID, 'invalid id');

export const FeedbackInputSchema = z
  .object({
    target_type: FeedbackTargetSchema,
    target_id: Id,
    slide_id: z.string().min(1).max(160).optional().nullable(),
    anchor: FeedbackAnchorSchema.optional().nullable(),
    kind: FeedbackKindSchema,
    body: z.string().trim().min(1, 'Write a note first.').max(4000),
  })
  .superRefine((v, ctx) => {
    if (v.target_type === 'slide' && !v.slide_id) ctx.addIssue({ code: 'custom', path: ['slide_id'], message: 'slide_id is required for a slide' });
    if (v.target_type !== 'slide' && v.slide_id) ctx.addIssue({ code: 'custom', path: ['slide_id'], message: 'slide_id only applies to slides' });
    if (v.target_type !== 'doc' && v.anchor) ctx.addIssue({ code: 'custom', path: ['anchor'], message: 'anchor only applies to docs' });
  });

export const FeedbackUpdateSchema = z
  .object({
    status: FeedbackStatusSchema.optional(),
    reply: z.string().trim().max(8000).optional(),
    resolved_note: z.string().trim().max(4000).optional(),
  })
  .refine((v) => v.status !== undefined || v.reply !== undefined || v.resolved_note !== undefined, 'Nothing to update.');

export type FeedbackKind = z.infer<typeof FeedbackKindSchema>;
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;
export type FeedbackTarget = z.infer<typeof FeedbackTargetSchema>;
export type FeedbackAnchor = z.infer<typeof FeedbackAnchorSchema>;
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
export type FeedbackUpdate = z.infer<typeof FeedbackUpdateSchema>;

export interface BrainFeedbackRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  author_id: string | null;
  target_type: FeedbackTarget;
  target_id: string;
  deck_id: string | null;
  slide_id: string | null;
  anchor: FeedbackAnchor | null;
  kind: FeedbackKind;
  body: string;
  status: FeedbackStatus;
  resolved_note: string | null;
  reply: string | null;
  replied_at: string | null;
  synced_to_brain_at: string | null;
}

export const FEEDBACK_COLUMNS =
  'id, created_at, updated_at, author_id, target_type, target_id, deck_id, slide_id, anchor, kind, body, status, resolved_note, reply, replied_at, synced_to_brain_at';

export function feedbackInsertRow(input: FeedbackInput, authorId: string | null) {
  const isDeck = input.target_type === 'deck' || input.target_type === 'slide';
  return {
    author_id: authorId,
    target_type: input.target_type,
    target_id: input.target_id,
    deck_id: isDeck ? input.target_id : null,
    slide_id: input.target_type === 'slide' ? input.slide_id ?? null : null,
    anchor: input.target_type === 'doc' ? input.anchor ?? null : null,
    kind: input.kind,
    body: input.body,
  };
}

/* ---------------------------------------------------------------- data helpers (pass a service-role client) */

export async function insertFeedback(client: SupabaseClient, input: FeedbackInput, authorId: string | null) {
  return client.from(BRAIN_FEEDBACK_TABLE).insert(feedbackInsertRow(input, authorId)).select(FEEDBACK_COLUMNS).single<BrainFeedbackRow>();
}

export async function listFeedbackFor(client: SupabaseClient, targetType: 'deck' | 'doc', targetId: string) {
  // Deck pages show deck-level and slide-level notes together.
  const types = targetType === 'deck' ? ['deck', 'slide'] : ['doc'];
  return client
    .from(BRAIN_FEEDBACK_TABLE)
    .select(FEEDBACK_COLUMNS)
    .in('target_type', types)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true })
    .limit(1000)
    .returns<BrainFeedbackRow[]>();
}

export function feedbackPatch(update: FeedbackUpdate, now: string = new Date().toISOString()) {
  const patch: Record<string, unknown> = { updated_at: now };
  if (update.status !== undefined) patch.status = update.status;
  if (update.reply !== undefined) {
    patch.reply = update.reply || null;
    patch.replied_at = update.reply ? now : null;
  }
  if (update.resolved_note !== undefined) patch.resolved_note = update.resolved_note || null;
  return patch;
}

/* ---------------------------------------------------------------- inbox formatting */

export interface InboxContext {
  deckTitles?: Record<string, string>;
  slideTitles?: Record<string, string>; // key: `${deckId}/${slideId}`
  docs?: Record<string, { title: string; path: string }>; // key: doc slug
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** One markdown entry per row. The `feedback-id` marker makes re-runs idempotent. */
export function formatInboxEntry(row: BrainFeedbackRow, ctx: InboxContext = {}): string {
  const lines: string[] = [];
  const when = row.created_at;
  if (row.target_type === 'doc') {
    const doc = ctx.docs?.[row.target_id];
    const docPath = row.anchor?.docPath ?? doc?.path;
    lines.push(`## ${when} · ${row.kind} · doc ${docPath ?? row.target_id}`);
    lines.push(`<!-- feedback-id: ${row.id} -->`);
    lines.push(`- id: \`${row.id}\``);
    lines.push(`- doc: ${docPath ? `\`${docPath}\`` : '(path unknown)'}${doc?.title ? ` (${doc.title})` : ''} · slug \`${row.target_id}\``);
    const heading = row.anchor?.headingPath?.length ? row.anchor.headingPath.join(' > ') : '(top of doc)';
    lines.push(`- section: ${heading}`);
    if (row.anchor?.quote) lines.push(`- quoted: "${oneLine(row.anchor.quote)}"`);
    if (row.anchor?.versionHash) lines.push(`- version: \`${row.anchor.versionHash}\``);
  } else {
    const deckTitle = ctx.deckTitles?.[row.target_id];
    lines.push(`## ${when} · ${row.kind} · deck ${row.target_id}${row.slide_id ? ` / ${row.slide_id}` : ''}`);
    lines.push(`<!-- feedback-id: ${row.id} -->`);
    lines.push(`- id: \`${row.id}\``);
    lines.push(`- deck: \`${row.target_id}\`${deckTitle ? ` (${deckTitle})` : ''}`);
    if (row.slide_id) {
      const slideTitle = ctx.slideTitles?.[`${row.target_id}/${row.slide_id}`];
      lines.push(`- slide: \`${row.slide_id}\`${slideTitle ? ` (${slideTitle})` : ''}`);
    } else {
      lines.push('- slide: whole deck');
    }
  }
  lines.push(`- kind: ${row.kind}`);
  lines.push(`- status: ${row.status}`);
  lines.push(`- time: ${when}`);
  lines.push('');
  lines.push(...row.body.split('\n').map((l) => `> ${l}`));
  lines.push('');
  lines.push(`Reply: \`scripts/brain/reply-feedback.ts ${row.id} --status applied|answered --reply "..."\``);
  lines.push('');
  return lines.join('\n');
}

export function inboxHeader(date: string): string {
  return `# Feedback inbox ${date}\n\nComments left in /admin/brain (decks, slides, docs), written by scripts/brain/pull-feedback.ts. Append-only; one entry per comment, body verbatim.\n\n`;
}

/** Ids already written to an inbox file (so a re-run never duplicates an entry). */
export function idsInInbox(markdown: string): Set<string> {
  const ids = new Set<string>();
  for (const m of markdown.matchAll(/feedback-id:\s*([0-9a-f-]{36})/g)) ids.add(m[1]);
  return ids;
}
