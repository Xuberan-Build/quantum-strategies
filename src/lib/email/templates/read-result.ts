/**
 * R1: the Perception Read result email (pure rendering, no I/O). Spec v3 §10, v1 §8.
 *
 * Transactional: sent to everyone who unlocks the result, whatever their marketing
 * consent. Suppressed for the crisis tier (the caller never renders it then).
 *
 * Job 1: get them back to the full Read. One primary button.
 * Job 2: the one move, so the email is useful even if they never click.
 * Job 3: Rite I at $12, as a quiet secondary block under the sign-off.
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

export interface ReadResultEmailData {
  pattern: PatternId;
  /** Shown name (segment wordings included). Falls back to the canonical name. */
  patternName?: string | null;
  /** One-line read. Falls back to the canonical read. */
  patternRead?: string | null;
  /** The week mirror, one to three plain lines. Empty when there's no mirror. */
  mirrorLines: string[];
  /** The one move, plain text. */
  move?: string | null;
  /** What to watch while doing the move. */
  watch?: string | null;
  /** Absolute signed link to the full result (no UTMs yet). */
  resultUrl: string;
  /** Rite I offer. Null hides the block. checkoutUrl is the /read/checkout bridge. */
  offer: { scanName: string; priceUsd: number; checkoutUrl: string } | null;
  consentMarketing: boolean;
  /** Absolute unsubscribe page link. */
  unsubscribeUrl: string;
  founderName?: string;
  businessName?: string;
  replyEmail?: string;
}

/**
 * Subject: the pattern name, which is already their words (naming rules N1, N3).
 * Options considered:
 *   A. "Your Perception Read: {name}"   <- chosen: says what it is and names the pattern
 *   B. "{name}. Here's your full Read"   (reads as a reveal)
 *   C. "You said it. Here's what it means" (vague, no pattern)
 */
export function readResultSubject(name: string): string {
  return `Your Perception Read: ${name}`;
}

export function renderReadResultEmail(data: ReadResultEmailData): RenderedReadEmail {
  const founder = data.founderName ?? 'Austin';
  const business = data.businessName ?? 'Quantum Strategies';
  const canonical = READ_PATTERN_COPY[data.pattern];
  const name = toPlain(data.patternName) || canonical.name;
  const read = toPlain(data.patternRead) || canonical.read;
  const mirror = data.mirrorLines.map((l) => toPlain(l)).filter(Boolean);
  const move = toPlain(data.move);
  const watch = toPlain(data.watch);

  const subject = readResultSubject(name);
  const preheader = mirror[0] ?? read;

  const openUrl = withReadUtm(data.resultUrl, 'r1', 'open_button');
  const moveLinkUrl = withReadUtm(data.resultUrl, 'r1', 'move_link');
  const offerUrl = data.offer ? withReadUtm(data.offer.checkoutUrl, 'r1', 'offer_rite1') : '';

  const fullReadLine =
    "Your full Read is saved at the link below. It shows why the things you've tried didn't stick, what's going on underneath, and the one thing to do this week.";
  const replyLine = "If any of it reads wrong, reply and tell me which part. Replies come straight to me, and they're how the Read gets better.";

  const sig = signature(founder, business);
  const e = escapeHtml;

  // ── Body ────────────────────────────────────────────────────────────────
  const mirrorHtml = mirror.length
    ? `      <div class="mirror">
        <p class="label">Your week</p>
        ${mirror.map((l) => `<p>${e(l)}</p>`).join('\n        ')}
      </div>`
    : '';

  const moveHtml = move
    ? `      <div class="move">
        <p class="label">Your one move this week</p>
        ${paragraphsHtml(move)}
        ${watch ? `<p style="margin:0;"><strong>What to watch:</strong> ${e(watch)}</p>` : ''}
      </div>`
    : `      <p>Your Read ends with one move for this week. <a class="link" href="${e(moveLinkUrl)}">It's at the bottom of your Read</a>.</p>`;

  const offerHtml = data.offer
    ? `      <div class="offer">
        <p class="label">If you want to go further</p>
        <p class="offer-head">Rite I, $${data.offer.priceUsd}</p>
        <p>Rite I is all five Perception scans. It starts with ${e(data.offer.scanName)}, the scan that goes deeper on this pattern. It's $${data.offer.priceUsd} for all five, and your account is set up at checkout.</p>
        <p style="margin:0;"><a href="${e(offerUrl)}" class="link">Get Rite I · start with ${e(data.offer.scanName)}</a></p>
      </div>`
    : '';

  const bodyHtml = [
    mirrorHtml,
    `      <p><strong>Your pattern: ${e(name)}.</strong> ${e(read)}</p>`,
    `      <p>${e(fullReadLine)}</p>`,
    `      <div class="cta"><a href="${e(openUrl)}" class="button">Open your full Read</a></div>`,
    moveHtml,
    `      <p>${e(replyLine)}</p>`,
    `      ${sig.html}`,
    offerHtml,
  ]
    .filter(Boolean)
    .join('\n');

  // ── Footer: differs by marketing consent ───────────────────────────────
  const consentLine = data.consentMarketing
    ? "You asked for follow-ups, so I'll check in about your move on day 2 and day 7."
    : "You're getting this because you asked for your Perception Read. It's the only email we'll send you about it.";
  const unsubLabel = data.consentMarketing ? 'Unsubscribe in one click' : "Don't email me again";
  const footerHtml = `      <p>${e(consentLine)}</p>
      <p><a href="${e(data.unsubscribeUrl)}">${e(unsubLabel)}</a>${data.replyEmail ? ` · Questions go to ${e(data.replyEmail)}` : ''}</p>
      <p>${e(business)}</p>`;

  const html = renderShell({
    subject,
    preheader,
    eyebrow: 'Your Perception Read',
    heading: name,
    bodyHtml,
    footerHtml,
  });

  // ── Plain text ──────────────────────────────────────────────────────────
  const text = [
    ...(mirror.length ? ['YOUR WEEK', ...mirror, ''] : []),
    `Your pattern: ${name}. ${read}`,
    '',
    fullReadLine,
    '',
    'OPEN YOUR FULL READ:',
    openUrl,
    '',
    ...(move
      ? ['YOUR ONE MOVE THIS WEEK', move, ...(watch ? ['', `What to watch: ${watch}`] : []), '']
      : [`Your Read ends with one move for this week. It's at the bottom of your Read: ${moveLinkUrl}`, '']),
    replyLine,
    '',
    sig.text,
    ...(data.offer
      ? [
          '',
          'IF YOU WANT TO GO FURTHER',
          `Rite I, $${data.offer.priceUsd}`,
          `Rite I is all five Perception scans. It starts with ${data.offer.scanName}, the scan that goes deeper on this pattern. It's $${data.offer.priceUsd} for all five, and your account is set up at checkout.`,
          `Get Rite I, start with ${data.offer.scanName}: ${offerUrl}`,
        ]
      : []),
    '',
    '---',
    consentLine,
    `${unsubLabel}: ${data.unsubscribeUrl}`,
  ].join('\n');

  return { subject, preheader, html, text };
}
