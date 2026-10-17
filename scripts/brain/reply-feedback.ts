/**
 * Post Claude's reply and a status back onto a brain feedback row, after acting on it
 * (usually: edit the brain file, republish docs, then reply).
 *
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/reply-feedback.ts \
 *     <feedback-id> --status applied|answered|open|resolved|dismissed [--reply "..."] [--note "..."]
 *
 * Uses the service role (local, operator-only: the key lives in the app's .env and never
 * reaches a browser). Shows up in /admin/brain beside the comment.
 * Exit codes: 0 ok · 2 usage · 4 database failure / not found.
 */
import {
  BRAIN_FEEDBACK_TABLE,
  FEEDBACK_COLUMNS,
  FeedbackUpdateSchema,
  feedbackPatch,
  type BrainFeedbackRow,
} from '../../src/lib/brain/feedback';
import { serviceClient } from './lib/storage';

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const id = args.find((a, i) => !a.startsWith('--') && !['--status', '--reply', '--note'].includes(args[i - 1] ?? ''));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const usage = 'usage: reply-feedback.ts <feedback-id> --status applied|answered|open|resolved|dismissed [--reply "..."] [--note "..."]';
if (!id || !UUID.test(id)) {
  console.error(usage);
  process.exit(2);
}
const parsed = FeedbackUpdateSchema.safeParse({ status: opt('--status'), reply: opt('--reply'), resolved_note: opt('--note') });
if (!parsed.success) {
  console.error(`${usage}\n${parsed.error.issues.map((i) => `- ${i.path.join('.') || 'args'}: ${i.message}`).join('\n')}`);
  process.exit(2);
}

async function main() {
  const sb = serviceClient();
  const { data, error } = await sb
    .from(BRAIN_FEEDBACK_TABLE)
    .update(feedbackPatch(parsed.data!))
    .eq('id', id as string)
    .select(FEEDBACK_COLUMNS)
    .maybeSingle<BrainFeedbackRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`no feedback row ${id}`);
  console.log(`feedback ${data.id}: status=${data.status}${data.reply ? ` · replied ${data.replied_at}` : ''}`);
}

main().catch((e) => {
  console.error('reply-feedback failed:', e instanceof Error ? e.message : e);
  process.exit(4);
});
