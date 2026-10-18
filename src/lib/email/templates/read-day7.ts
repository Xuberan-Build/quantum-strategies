/**
 * A5, day 7: three one-click questions (pure rendering, no I/O). Spec v3 §10, v1 §8.
 *
 *   1. Did you do the move at least once? (H9, event move_done_day7)
 *   2. The Q10 baseline re-rated with the same anchors (event day7_rerating)
 *   3. The PMF question, Sean Ellis adapted (H5, event day7_pmf). "Very" or
 *      "somewhat" opens the Superhuman follow-ups on the answer page.
 *
 * Marketing email: consented, not unsubscribed. Each answer is a signed link.
 */

import type { PatternId } from '@/lib/read/types';
import type { ReadAnswerQuestion } from '@/lib/read/email-links';
import {
  READ_PATTERN_COPY,
  escapeHtml,
  renderShell,
  signature,
  toPlain,
  withReadUtm,
  type RenderedReadEmail,
} from './read-shared';

export interface ReadDay7EmailData {
  pattern: PatternId;
  patternName?: string | null;
  /** Q10 answer on the day they took the Read, 1 to 10. */
  baseline?: number | null;
  resultUrl: string;
  unsubscribeUrl: string;
  /** Builds the signed one-click link for an answer (absolute, without UTMs). */
  answerUrl: (question: ReadAnswerQuestion, value: string) => string;
  founderName?: string;
  businessName?: string;
}

export const DAY7_SUBJECT = 'Day 7: three quick questions';

export const DAY7_QUESTIONS = {
  move: {
    title: 'Did you do the move at least once?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'started_stopped', label: 'Started, then stopped' },
      { value: 'no', label: 'No' },
    ],
  },
  rerate: {
    title: "How much of last week went the way you'd have chosen?",
    hint: '1 = almost none of it · 5 = about half · 10 = all of it',
  },
  pmf: {
    title: "If you couldn't get the full Rite I, how would you feel?",
    options: [
      { value: 'very', label: 'Very disappointed' },
      { value: 'somewhat', label: 'Somewhat disappointed' },
      { value: 'not', label: 'Not disappointed' },
      { value: 'have_it', label: "I've already got it" },
    ],
  },
} as const;

export function renderReadDay7Email(data: ReadDay7EmailData): RenderedReadEmail {
  const founder = data.founderName ?? 'Austin';
  const business = data.businessName ?? 'Quantum Strategies';
  const name = toPlain(data.patternName) || READ_PATTERN_COPY[data.pattern].name;
  const subject = DAY7_SUBJECT;
  const preheader = 'One click each. It takes about 20 seconds.';
  const resultUrl = withReadUtm(data.resultUrl, 'day7', 'result_link');
  const link = (q: ReadAnswerQuestion, v: string) => withReadUtm(data.answerUrl(q, v), 'day7', `${q}_${v}`);

  const baseline =
    typeof data.baseline === 'number' && data.baseline >= 1 && data.baseline <= 10 ? Math.round(data.baseline) : null;

  const intro =
    "It's been a week since your Perception Read. I have three questions, and each one is a single click. Your answers decide what I build next.";
  const baselineLine = baseline
    ? `When you took the Read, you said ${baseline} out of 10. Same scale, for this past week:`
    : 'Same scale as the Read, for this past week:';
  const close = "If you'd rather write than click, hit reply. Replies come straight to me.";

  const sig = signature(founder, business);
  const e = escapeHtml;

  const chips = (q: ReadAnswerQuestion, options: readonly { value: string; label: string }[]) =>
    options.map((o) => `<a class="chip" href="${e(link(q, o.value))}">${e(o.label)}</a>`).join('');
  const scale = Array.from({ length: 10 }, (_, i) => String(i + 1));

  const bodyHtml = [
    `      <p>${e(intro)}</p>`,
    `      <div class="q">
        <p class="q-title">1. ${e(DAY7_QUESTIONS.move.title)}</p>
        <div>${chips('move', DAY7_QUESTIONS.move.options)}</div>
      </div>`,
    `      <div class="q scale">
        <p class="q-title">2. ${e(DAY7_QUESTIONS.rerate.title)}</p>
        <p style="font-size:15px;margin:0 0 10px 0;">${e(baselineLine)}</p>
        <div>${chips('rerate', scale.map((v) => ({ value: v, label: v })))}</div>
        <p class="hint">${e(DAY7_QUESTIONS.rerate.hint)}</p>
      </div>`,
    `      <div class="q">
        <p class="q-title">3. ${e(DAY7_QUESTIONS.pmf.title)}</p>
        <div>${chips('pmf', DAY7_QUESTIONS.pmf.options)}</div>
      </div>`,
    `      <p style="margin-top:28px;">${e(close)}</p>`,
    `      ${sig.html}`,
  ].join('\n');

  const footerHtml = `      <p><a href="${e(resultUrl)}">Your full Read</a> · <a href="${e(data.unsubscribeUrl)}">Unsubscribe in one click</a></p>
      <p>You're getting this because you asked for follow-ups when you took the Perception Read.</p>
      <p>${e(business)}</p>`;

  const html = renderShell({ subject, preheader, eyebrow: 'Day 7', heading: name, bodyHtml, footerHtml });

  const textOptions = (q: ReadAnswerQuestion, options: readonly { value: string; label: string }[]) =>
    options.map((o) => `- ${o.label}: ${link(q, o.value)}`);

  const text = [
    intro,
    '',
    `1. ${DAY7_QUESTIONS.move.title}`,
    ...textOptions('move', DAY7_QUESTIONS.move.options),
    '',
    `2. ${DAY7_QUESTIONS.rerate.title}`,
    baselineLine,
    `(${DAY7_QUESTIONS.rerate.hint})`,
    ...textOptions('rerate', scale.map((v) => ({ value: v, label: v }))),
    '',
    `3. ${DAY7_QUESTIONS.pmf.title}`,
    ...textOptions('pmf', DAY7_QUESTIONS.pmf.options),
    '',
    close,
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
