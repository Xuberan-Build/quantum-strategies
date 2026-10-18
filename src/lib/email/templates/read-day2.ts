/**
 * A2, day 2: the move check-in (pure rendering, no I/O). Spec v1 §8, kept in v3 §10.
 *
 * Marketing email: only for leads who ticked the consent box and haven't unsubscribed.
 * One CTA: reply in one line. Replies are the cheapest qualitative signal we get
 * (threshold: day-2 replies ≥10% of emails, spec v1 §10.2).
 */

import type { PatternId } from '@/lib/read/types';
import {
  READ_PATTERN_COPY,
  escapeHtml,
  paragraphsHtml,
  renderShell,
  signature,
  toPlain,
  withReadUtm,
  type RenderedReadEmail,
} from './read-shared';

export interface ReadDay2EmailData {
  pattern: PatternId;
  patternName?: string | null;
  move?: string | null;
  watch?: string | null;
  resultUrl: string;
  unsubscribeUrl: string;
  founderName?: string;
  businessName?: string;
}

/** A real question from their week, keyed to the pattern's move (naming rules, email subjects). */
export const DAY2_SUBJECTS: Record<PatternId, string> = {
  SHOULDS: 'Did you drop the should, or book the hour?',
  NOT_CAUGHT_UP: 'How many lines have you written so far?',
  ON_EMPTY: "How's the count going?",
  NO_THREAD: 'Have you asked anyone yet?',
  SMALLER: 'How many "justs" did you cross out?',
};

export function renderReadDay2Email(data: ReadDay2EmailData): RenderedReadEmail {
  const founder = data.founderName ?? 'Austin';
  const business = data.businessName ?? 'Quantum Strategies';
  const name = toPlain(data.patternName) || READ_PATTERN_COPY[data.pattern].name;
  const move = toPlain(data.move);
  const watch = toPlain(data.watch);
  const subject = DAY2_SUBJECTS[data.pattern];
  const resultUrl = withReadUtm(data.resultUrl, 'day2', 'result_link');

  const intro = move
    ? 'Two days ago your Perception Read gave you one thing to try this week:'
    : `Two days ago your Perception Read (${name}) gave you one thing to try this week. It's at the bottom of your Read.`;
  const ask = "How's it going? Hit reply and tell me in one line. \"Haven't started\" is a useful answer too. Replies come straight to me.";
  const slip = "If you've missed a day, that's normal. Missing a day doesn't undo it, so pick it back up today.";
  const preheader = 'One line back is plenty.';

  const sig = signature(founder, business);
  const e = escapeHtml;

  const bodyHtml = [
    `      <p>${e(intro)}</p>`,
    move
      ? `      <div class="move">
        ${paragraphsHtml(move)}
        ${watch ? `<p style="margin:0;"><strong>What to watch:</strong> ${e(watch)}</p>` : ''}
      </div>`
      : '',
    `      <p><strong>${e(ask)}</strong></p>`,
    `      <p>${e(slip)}</p>`,
    `      ${sig.html}`,
  ]
    .filter(Boolean)
    .join('\n');

  const footerHtml = `      <p><a href="${e(resultUrl)}">Your full Read</a> · <a href="${e(data.unsubscribeUrl)}">Unsubscribe in one click</a></p>
      <p>You're getting this because you asked for follow-ups when you took the Perception Read.</p>
      <p>${e(business)}</p>`;

  const html = renderShell({ subject, preheader, eyebrow: 'Day 2 of your move', heading: name, bodyHtml, footerHtml });

  const text = [
    intro,
    ...(move ? ['', move, ...(watch ? ['', `What to watch: ${watch}`] : [])] : []),
    '',
    ask,
    '',
    slip,
    '',
    sig.text,
    '',
    '---',
    `Your full Read: ${resultUrl}`,
    `Unsubscribe in one click: ${data.unsubscribeUrl}`,
    "You're getting this because you asked for follow-ups when you took the Perception Read.",
  ].join('\n');

  return { subject, preheader, html, text };
}
