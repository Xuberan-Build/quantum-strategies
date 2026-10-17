/**
 * Founding Member conversion emails for the beta cohort (DRAFTS, NOT WIRED TO ANY SENDER).
 *
 * Three emails: invitation, value + Rite I nudge, deadline reminder.
 * Austin sends these himself after approving the copy. Nothing in the app imports
 * this file, so nothing goes out automatically.
 *
 * Copy source and send plan: brain/gtm/beta-conversion-emails.md
 * Offer design: brain/gtm/beta-conversion-offer.md
 */

export interface FoundingEmailData {
  /** First name. Falls back to "there". */
  name?: string | null;
  /** Server-computed price in dollars (getFoundingOffer().pricing.price). */
  price: number;
  /** What they've already paid, in dollars (pricing.credit). */
  credit: number;
  /** beta_participants progress fields. */
  perceptionDone: number;
  orientationDone: number;
  declarationDone: number;
  /** Name of the next product they haven't finished, if known (from product_sessions). */
  nextProductName?: string | null;
  /** e.g. "Sunday, November 15" */
  closesLabel: string;
  /** https://<app>/dashboard/founding */
  offerUrl: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function firstName(name?: string | null): string {
  const first = (name || '').trim().split(/\s+/)[0];
  return first || 'there';
}

function priceLine(d: FoundingEmailData): string {
  if (d.credit > 0) {
    return `You've already paid ${money(d.credit)}, so your price is ${money(d.price)}.`;
  }
  return `Your price is ${money(d.price)}.`;
}

const BENEFITS = [
  'Every new Rite and app product I release from here, included.',
  'A 45-minute debrief call with me on what your scans showed and what to do next.',
  'The Founding Member role in Discord, and your name on the founding circle list if you want it there.',
  'First access to new products before they go public, and priority when you message me.',
];

/** Plain, personal layout. Paragraphs are plain text; `benefits` renders as a list. */
function render(paragraphs: Array<string | { list: string[] } | { link: string; label: string }>): {
  html: string;
  text: string;
} {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const htmlParts = paragraphs.map((p) => {
    if (typeof p === 'string') return `<p>${esc(p)}</p>`;
    if ('list' in p) return `<ul>${p.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
    return `<p><a href="${p.link}" style="color:#5d3fd3;font-weight:600;">${esc(p.label)}</a></p>`;
  });

  const textParts = paragraphs.map((p) => {
    if (typeof p === 'string') return p;
    if ('list' in p) return p.list.map((li) => `- ${li}`).join('\n');
    return `${p.label}: ${p.link}`;
  });

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#222;max-width:560px;margin:24px auto;padding:0 16px;">
${htmlParts.join('\n')}
<p>Austin</p>
</body>
</html>`;

  return { html, text: `${textParts.join('\n\n')}\n\nAustin` };
}

/** Email 1: the invitation. Send day 0. */
export function getFoundingInviteEmail(d: FoundingEmailData): EmailContent {
  const { html, text } = render([
    `Hi ${firstName(d.name)},`,
    "When you joined the beta I said that at the end you'd get the chance to become a Founding Member for $60, minus anything you'd already bought. That offer is open now, and I want to keep the promise as I made it.",
    priceLine(d),
    'Here is what Founding Members get:',
    { list: BENEFITS },
    "You don't have to pay to keep what you have. All 11 products stay yours with no end date, whatever you decide.",
    `The offer is open until ${d.closesLabel}. After that the founding price and the call close, and I put my time into building the next Rite with the people who joined.`,
    { link: d.offerUrl, label: 'See your Founding Member offer' },
    "If something stopped you partway through, reply and tell me what it was. I read every reply, and it's the most useful thing you can send me right now.",
  ]);
  return { subject: 'The Founding Member offer I promised you', html, text };
}

/** Email 2: value plus the Rite I nudge. Send day 7 to anyone who hasn't joined. */
export function getFoundingValueEmail(d: FoundingEmailData): EmailContent {
  const stalledInRiteOne = d.perceptionDone < 5;
  const next = d.nextProductName ? ` The next one for you is ${d.nextProductName}, and it takes about 20 minutes.` : '';

  const progress: string[] = stalledInRiteOne
    ? [
        `You've done ${d.perceptionDone} of the 5 Perception scans. Most of the beta is in the same spot, and 10 of the 12 of you stopped somewhere in Rite I.${next}`,
        "I don't read that as a motivation problem. The scans show you a pattern and then leave you to work out the next move on your own. That part is on me, and I'm fixing it in the product.",
      ]
    : [
        `You've finished Rite I, and you're ${d.orientationDone} of 3 into Orientation and ${d.declarationDone} of 3 into Declaration.${next}`,
        'Orientation is where the scans turn into a plan for your life, your business and your brand, so it is the best place to spend the next hour.',
      ];

  const { html, text } = render([
    `Hi ${firstName(d.name)},`,
    "The note that came up most in the beta feedback was some version of \"my values don't match what I'm actually doing\". Three of you wrote it. That's the pattern the Rites are built to find, and once you can see it you can start changing it.",
    ...progress,
    'The one thing a beta user asked for directly was accountability. That is why the founding offer includes a 45-minute call with me. We look at what your scans showed and pick one move for the next two weeks.',
    `${priceLine(d)} It's open until ${d.closesLabel}.`,
    { link: d.offerUrl, label: 'See your Founding Member offer' },
    "If you'd rather just finish the scans, that's fine too. Reply and I'll help you get unstuck either way.",
  ]);
  return {
    subject: stalledInRiteOne ? 'Where most of the beta got stuck' : 'What comes after Rite I',
    html,
    text,
  };
}

/** Email 3: deadline reminder. Send two days before close to anyone who hasn't joined. */
export function getFoundingDeadlineEmail(d: FoundingEmailData): EmailContent {
  const { html, text } = render([
    `Hi ${firstName(d.name)},`,
    `The Founding Member offer closes on ${d.closesLabel} at 11:59pm Pacific. ${priceLine(d)}`,
    'It includes every new Rite and app product I release, a 45-minute call with me, the Founding Member role in Discord and first access to what I build next.',
    "After it closes your beta access stays as it is. You keep all 11 products. What goes away is the founding price and the call.",
    { link: d.offerUrl, label: 'Become a Founding Member' },
    "If you've decided it's not for you, reply with one line on why. That helps me more than you'd think.",
  ]);
  return { subject: `Founding Member closes ${d.closesLabel}`, html, text };
}
