/**
 * Renders sample Perception Read emails (R1 both consent states, day 2, day 7) to a
 * folder for copy review. No DB, no sending.
 *
 *   npx tsx scripts/read/render-sample-emails.ts [outDir]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderReadResultEmail } from '../../src/lib/email/templates/read-result';
import { renderReadDay2Email } from '../../src/lib/email/templates/read-day2';
import { renderReadDay7Email } from '../../src/lib/email/templates/read-day7';
import type { RenderedReadEmail } from '../../src/lib/email/templates/read-shared';

process.env.READ_LINK_SECRET ||= 'sample-only';

async function main() {
  const { answerPageUrl, readCheckoutUrl, unsubscribePageUrl } = await import('../../src/lib/read/email-links');
  const out = path.resolve(process.argv[2] || '.read-email-previews/samples');
  mkdirSync(out, { recursive: true });

  const APP = 'https://www.quantumstrategies.online';
  const SESSION = '11111111-1111-4111-8111-111111111111';
  const LEAD = '22222222-2222-4222-8222-222222222222';
  const resultUrl = `${APP}/read/result/${SESSION}/?t=SIGNED`;
  const unsubscribeUrl = unsubscribePageUrl(APP, LEAD);

  const samples: Record<string, RenderedReadEmail> = {
    'r1-shoulds-consent': renderReadResultEmail({
      pattern: 'SHOULDS',
      patternName: 'Running on shoulds',
      mirrorLines: [
        'You keep meaning to get to "writing again".',
        'Last week it got 0 hours. Things you thought you should do got most of the rest.',
        "You called it something you think you're supposed to want.",
      ],
      move:
        'Take "writing again". On paper, finish this line: "I should do this because…". If the reason is someone else\'s opinion, drop it on purpose for 7 days. If the reason is yours, put one hour for it in your calendar now.\n\nDon\'t add anything else this week. No new app, book or video. Just this.',
      watch: 'Which feels lighter by Sunday: the thing you dropped or the hour you kept.',
      resultUrl,
      offer: { scanName: 'Value Pattern Decoder', priceUsd: 12, checkoutUrl: readCheckoutUrl(APP, SESSION) },
      consentMarketing: true,
      unsubscribeUrl,
      replyEmail: 'austin@quantumstrategies.online',
    }),
    'r1-on-empty-no-consent': renderReadResultEmail({
      pattern: 'ON_EMPTY',
      patternName: 'Yes to everyone but you',
      mirrorLines: [
        'You keep meaning to get to "the online course I started in spring".',
        "Last week it got 1–2 hours. Other people's asks got most of the rest.",
        'You called it something you want.',
      ],
      move:
        'For the next 7 days, when someone asks you for something, say "Let me check and come back to you" before you answer. Make a tally mark each time you\'d have said yes on the spot.',
      watch: "How many marks you make, and what you felt when you didn't say yes straight away.",
      resultUrl,
      offer: { scanName: 'Boundary & Burnout', priceUsd: 12, checkoutUrl: readCheckoutUrl(APP, SESSION) },
      consentMarketing: false,
      unsubscribeUrl,
      replyEmail: 'austin@quantumstrategies.online',
    }),
    'day2-on-empty': renderReadDay2Email({
      pattern: 'ON_EMPTY',
      patternName: 'Yes to everyone but you',
      move:
        'For the next 7 days, when someone asks you for something, say "Let me check and come back to you" before you answer. Make a tally mark each time you\'d have said yes on the spot.',
      watch: "How many marks you make, and what you felt when you didn't say yes straight away.",
      resultUrl,
      unsubscribeUrl,
    }),
    'day7-shoulds': renderReadDay7Email({
      pattern: 'SHOULDS',
      patternName: 'Running on shoulds',
      baseline: 4,
      resultUrl,
      unsubscribeUrl,
      answerUrl: (q, v) => answerPageUrl(APP, LEAD, q, v),
    }),
  };

  for (const [name, email] of Object.entries(samples)) {
    writeFileSync(path.join(out, `${name}.html`), email.html, 'utf8');
    writeFileSync(path.join(out, `${name}.txt`), `Subject: ${email.subject}\nPreheader: ${email.preheader}\n\n${email.text}\n`, 'utf8');
  }
  console.log(`Wrote ${Object.keys(samples).length} samples to ${out}`);
}

main();
