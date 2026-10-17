/**
 * Post-purchase welcome email (pure rendering, no I/O).
 *
 * Job 1: get the buyer to start the product today. One primary button.
 * Job 2: the next purchase, as a quiet block under the sign-off:
 *   - "complete the Rite" when they own part of a Rite, or
 *   - the next Rite (Perception → Orientation → Declaration) after a bundle or upgrade.
 *
 * Voice: Austin, first person, plain sentences (brain/content/tonality.md).
 * No em-dashes, no hype words, no "X, not Y" frames.
 */

export const WELCOME_UTM = {
  utm_source: 'email',
  utm_medium: 'transactional',
  utm_campaign: 'welcome',
} as const;

export type WelcomePurchaseKind = 'single' | 'bundle' | 'upgrade';

export interface WelcomeOfferBlock {
  type: 'complete-rite';
  riteName: string;
  /** Names of the products they still need, in Rite order. */
  missingNames: string[];
  price: number;
  savings: number;
  /** Absolute Rite page URL, without UTMs or hash. */
  pageUrl: string;
}

export interface WelcomeNextRiteBlock {
  type: 'next-rite';
  riteName: string;
  riteNumber: string;
  includedNames: string[];
  price: number;
  /** Absolute Rite page URL, without UTMs or hash. */
  pageUrl: string;
}

export interface WelcomeEmailData {
  /** Customer name from Stripe; may be a full name or the fallback "there". */
  name: string;
  email: string;
  kind: WelcomePurchaseKind;
  /** What they bought, as shown to them (product name or Rite name). */
  purchaseName: string;
  /** Rite name, when the purchase belongs to a Rite. */
  riteName?: string;
  /** The product the primary button opens. */
  start: { slug: string; name: string; duration?: string };
  /** Every product included in a bundle or upgrade (names, Rite order). */
  includedNames: string[];
  /** Absolute app base URL (no trailing slash). */
  appUrl: string;
  /** Secondary block. Omitted when there is nothing to offer or the lookup failed. */
  next?: WelcomeOfferBlock | WelcomeNextRiteBlock | null;
  founderName?: string;
  businessName?: string;
  replyEmail?: string;
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const BRAND_PRIMARY = '#030048';
const BRAND_ACCENT = '#6C5CE7';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Adds the welcome UTMs (plus utm_content) to an absolute URL, keeping any hash. */
export function withUtm(url: string, content: string): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(WELCOME_UTM)) u.searchParams.set(k, v);
  u.searchParams.set('utm_content', content);
  return u.toString();
}

function firstName(name: string): string {
  const first = (name || '').trim().split(/\s+/)[0];
  return first && first.toLowerCase() !== 'there' ? first : '';
}

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** "a, b and c" */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Subject line, specific to what they bought.
 *
 * Options considered (single product):
 *   A. "{product} is ready. It takes about {duration}."   <- chosen: names the
 *      product and removes the "how long will this take" objection before they open.
 *   B. "Start {product} today"
 *   C. "You're in. Here's how to start {product}"
 * Bundle: "{Rite} is yours. Start with {first product}." (chosen) / "Your {Rite} Rite is ready"
 * Upgrade: "You own all of {Rite} now. Next up: {product}." (chosen) / "{Rite} is complete. Start {product}"
 */
export function welcomeSubject(data: WelcomeEmailData): string {
  if (data.kind === 'bundle') {
    return `${data.riteName ?? data.purchaseName} is yours. Start with ${data.start.name}.`;
  }
  if (data.kind === 'upgrade') {
    return `You own all of ${data.riteName ?? data.purchaseName} now. Next up: ${data.start.name}.`;
  }
  return data.start.duration
    ? `${data.start.name} is ready. It takes about ${data.start.duration}.`
    : `${data.start.name} is ready to start`;
}

export function renderWelcomeEmail(data: WelcomeEmailData): RenderedEmail {
  const founder = data.founderName ?? 'Austin';
  const business = data.businessName ?? 'Quantum Strategies';
  const fname = firstName(data.name);
  const greeting = fname ? `Hi ${fname},` : 'Hi,';

  const startPath = `/products/${encodeURIComponent(data.start.slug)}/experience`;
  const startUrl = withUtm(`${data.appUrl}${startPath}`, 'start_button');
  const psUrl = withUtm(`${data.appUrl}${startPath}`, 'ps_link');
  const dashboardUrl = withUtm(`${data.appUrl}/dashboard`, 'dashboard');

  const subject = welcomeSubject(data);
  const durationLine = data.start.duration ? `about ${data.start.duration}` : 'a short sitting';

  // ── Copy ────────────────────────────────────────────────────────────────
  let confirmation: string;
  if (data.kind === 'bundle') {
    confirmation = `You now own the ${data.riteName ?? data.purchaseName} Rite: ${listNames(data.includedNames)}.`;
  } else if (data.kind === 'upgrade') {
    confirmation = `You now own all of ${data.riteName ?? data.purchaseName}: ${listNames(data.includedNames)}.`;
  } else {
    confirmation = `You now own ${data.start.name}. It's in your account and ready to start.`;
  }

  const startIntro =
    data.kind === 'single'
      ? `The best time to do it is today, while the reason you bought it is still fresh.`
      : `Start with ${data.start.name}. The rest are waiting in your dashboard when you finish.`;

  const expect = [
    `It takes ${durationLine}. Your progress saves, so you can stop and come back.`,
    `You answer a set of guided questions, one step at a time. At the end you get a written report you can keep.`,
    `The report is built from your own answers. If you add your birth details, the chart only gives us words for patterns. What you write decides what it says.`,
  ];

  const tip = `Answer with what you actually did this past month. Specific examples give the report much more to work with than general statements.`;

  const signOff = [
    `I built these because I needed them myself. The first sitting matters most, so give it a slot in your day today.`,
    `If anything gets in the way, reply to this email. It comes straight to me.`,
  ];

  const ps = `If you only do one thing today, open ${data.start.name}.`;
  const signInNote = `Sign in with ${data.email}, the email you used at checkout. If it's your first time, use "Sign up" with that same email.`;

  // ── Secondary block ─────────────────────────────────────────────────────
  let nextHtml = '';
  let nextText = '';
  if (data.next?.type === 'complete-rite') {
    const o = data.next;
    const url = withUtm(o.pageUrl, 'complete_rite') + '#bundle';
    const head = `Complete ${o.riteName} for ${money(o.price)}`;
    const body = `You already own part of ${o.riteName}. You can add the rest for ${money(o.price)}: ${listNames(o.missingNames)}. That's ${money(o.savings)} less than buying them one by one.`;
    nextHtml = `
      <div class="next">
        <p class="next-label">When you're ready</p>
        <p class="next-head">${escapeHtml(head)}</p>
        <p>${escapeHtml(body)}</p>
        <p style="margin:0;"><a href="${escapeHtml(url)}" class="next-link">See the ${escapeHtml(o.riteName)} offer</a></p>
      </div>`;
    nextText = `WHEN YOU'RE READY\n${head}\n${body}\n${url}`;
  } else if (data.next?.type === 'next-rite') {
    const n = data.next;
    const url = withUtm(n.pageUrl, 'next_rite') + '#bundle';
    const head = `Next: Rite ${n.riteNumber}, ${n.riteName}`;
    const body = `Once you've finished, ${n.riteName} is the next Rite. It includes ${listNames(n.includedNames)}, for ${money(n.price)}.`;
    nextHtml = `
      <div class="next">
        <p class="next-label">After this</p>
        <p class="next-head">${escapeHtml(head)}</p>
        <p>${escapeHtml(body)}</p>
        <p style="margin:0;"><a href="${escapeHtml(url)}" class="next-link">Look at ${escapeHtml(n.riteName)}</a></p>
      </div>`;
    nextText = `AFTER THIS\n${head}\n${body}\n${url}`;
  }

  const preheader =
    data.kind === 'single'
      ? `Start ${data.start.name} now. It takes ${durationLine}.`
      : `Start with ${data.start.name}. It takes ${durationLine}.`;

  const e = escapeHtml;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${BRAND_PRIMARY} 0%, #1a0066 100%); color: #F8F5FF; padding: 32px 30px; text-align: center; }
    .header p { margin: 0 0 6px 0; font-size: 14px; opacity: 0.85; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 700; line-height: 1.3; }
    .content { padding: 36px 30px; font-size: 16px; }
    .content p { margin: 0 0 16px 0; }
    .cta { text-align: center; margin: 28px 0 8px 0; }
    .button { display: inline-block; background: ${BRAND_ACCENT}; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 17px; }
    .small { font-size: 14px; color: #666; text-align: center; margin: 0 0 28px 0; }
    .expect { background: #f8f7ff; border-left: 4px solid ${BRAND_ACCENT}; border-radius: 8px; padding: 18px 20px; margin: 24px 0; }
    .expect h3 { margin: 0 0 10px 0; font-size: 16px; color: ${BRAND_PRIMARY}; }
    .expect ul { margin: 0; padding-left: 20px; }
    .expect li { margin-bottom: 8px; }
    .tip { margin: 24px 0; }
    .next { border: 1px solid #e6e3f5; border-radius: 8px; padding: 18px 20px; margin: 28px 0 0 0; font-size: 15px; }
    .next-label { margin: 0 0 4px 0 !important; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; }
    .next-head { margin: 0 0 8px 0 !important; font-weight: 600; color: ${BRAND_PRIMARY}; }
    .next-link { color: ${BRAND_ACCENT}; font-weight: 600; text-decoration: none; }
    .footer { background: #f8f9fa; padding: 24px 30px; text-align: center; color: #666; font-size: 13px; }
    .footer a { color: ${BRAND_ACCENT}; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .container { margin: 0; border-radius: 0; }
      .content { padding: 28px 20px; }
      .header { padding: 28px 20px; }
      .button { display: block; padding: 16px 20px; }
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${e(preheader)}</div>
  <div class="container">
    <div class="header">
      <p>Your purchase is confirmed</p>
      <h1>${e(data.kind === 'single' ? data.start.name : data.riteName ?? data.purchaseName)}</h1>
    </div>
    <div class="content">
      <p>${e(greeting)}</p>
      <p>${e(confirmation)}</p>
      <p>${e(startIntro)}</p>

      <div class="cta">
        <a href="${e(startUrl)}" class="button">Start ${e(data.start.name)}</a>
      </div>
      <p class="small">${e(signInNote)}</p>

      <div class="expect">
        <h3>What to expect</h3>
        <ul>
          ${expect.map((l) => `<li>${e(l)}</li>`).join('\n          ')}
        </ul>
      </div>

      <p class="tip"><strong>One tip:</strong> ${e(tip)}</p>

      ${signOff.map((l) => `<p>${e(l)}</p>`).join('\n      ')}
      <p>${e(founder)}<br><span style="color:#666;font-size:14px;">Founder, ${e(business)}</span></p>

      <p style="font-size:15px;"><strong>P.S.</strong> ${e(ps)} <a href="${e(psUrl)}" style="color:${BRAND_ACCENT};">Start it here</a>.</p>
      ${nextHtml}
    </div>
    <div class="footer">
      <p style="margin:0 0 8px 0;">Everything you own is in <a href="${e(dashboardUrl)}">your dashboard</a>.</p>
      <p style="margin:0;font-size:12px;color:#999;">You're getting this because you bought ${e(data.purchaseName)} from ${e(business)}.${data.replyEmail ? ` Questions go to ${e(data.replyEmail)}.` : ''}</p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    greeting,
    '',
    confirmation,
    '',
    startIntro,
    '',
    `START ${data.start.name.toUpperCase()}:`,
    startUrl,
    signInNote,
    '',
    'WHAT TO EXPECT',
    ...expect.map((l) => `- ${l}`),
    '',
    `ONE TIP: ${tip}`,
    '',
    ...signOff.flatMap((l) => [l, '']),
    founder,
    `Founder, ${business}`,
    '',
    `P.S. ${ps} ${psUrl}`,
    ...(nextText ? ['', nextText] : []),
    '',
    `Your dashboard: ${dashboardUrl}`,
  ].join('\n');

  return { subject, preheader, html, text };
}
