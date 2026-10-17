/**
 * Webhook Handler: Send Welcome Email
 *
 * Sends the post-purchase welcome email to the customer.
 * Copy and layout live in src/lib/email/templates/welcome-email.ts (pure).
 * This module resolves the data (product names, Rite, next offer) and sends via Gmail.
 *
 * Failure-safety: the offer lookup is optional. If it fails, the email goes out
 * without the offer block. The webhook also wraps this call in try/catch.
 *
 * Bundle contents come from BUNDLE_CONTENTS (bundles have no product_definitions
 * row, and product_definitions has no bundle_products column).
 */

import { google } from 'googleapis';
import { BUSINESS } from '../../../../config/business.config';
import { APP_URL, MARKETING_URL } from '@/lib/config/urls';
import { supabaseAdmin } from '@/lib/supabase/server';
import { BUNDLE_CONTENTS, RITE_INFO } from '@/lib/constants/bundles';
import { PRODUCTS } from '@/lib/constants/products';
import {
  getCompleteRiteOffer,
  ownsWholeRite,
  type AccessRowInput,
} from '@/lib/pricing/complete-the-rite';
import { getUserAccessRows } from '@/lib/pricing/complete-the-rite-server';
import {
  renderWelcomeEmail,
  type WelcomeEmailData,
  type WelcomeOfferBlock,
  type WelcomeNextRiteBlock,
} from '@/lib/email/templates/welcome-email';

function getGmailCredentials() {
  const client_email = process.env.GOOGLE_GMAIL_CLIENT_EMAIL || process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_GMAIL_PRIVATE_KEY || process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (private_key?.includes('\\n')) {
    private_key = private_key.replace(/\\n/g, '\n');
  }
  return { client_email, private_key };
}

/** The Rites in the order a buyer moves through them. */
export const RITE_ORDER = ['perception-rite-bundle', 'orientation-bundle', 'declaration-rite-bundle'] as const;
const RITE_NUMERALS = ['I', 'II', 'III'];

export function findRiteForSlug(slug: string): string | null {
  if (BUNDLE_CONTENTS[slug]) return slug;
  return Object.keys(BUNDLE_CONTENTS).find((b) => BUNDLE_CONTENTS[b].includes(slug)) ?? null;
}

/**
 * Display names for product slugs. Code constants first; anything unknown falls
 * back to product_definitions (the column is product_slug), then to the slug itself.
 */
async function getProductNames(slugs: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  const unknown: string[] = [];
  for (const slug of slugs) {
    const name = PRODUCTS[slug]?.name;
    if (name) names[slug] = name;
    else unknown.push(slug);
  }
  if (unknown.length > 0) {
    try {
      const { data } = await supabaseAdmin
        .from('product_definitions')
        .select('product_slug, name')
        .in('product_slug', unknown);
      for (const row of (data ?? []) as { product_slug: string; name: string }[]) {
        if (row.name) names[row.product_slug] = row.name;
      }
    } catch (err: any) {
      console.warn('[welcome-email] product name lookup failed:', err?.message);
    }
  }
  for (const slug of slugs) names[slug] ??= slug;
  return names;
}

/**
 * Pick the secondary block from the buyer's access rows (which already include
 * this purchase, since access is granted before the email is sent).
 * Walks the purchased Rite, then the Rites after it. The first Rite they don't
 * fully own wins: a "complete the Rite" offer if they own part of it, otherwise
 * the next Rite at its bundle price. Returns null when nothing fits.
 */
export function pickNextBlock(
  accessRows: AccessRowInput[],
  purchasedRite: string | null,
  names: Record<string, string>,
  marketingUrl: string,
): WelcomeOfferBlock | WelcomeNextRiteBlock | null {
  const startIndex = purchasedRite ? (RITE_ORDER as readonly string[]).indexOf(purchasedRite) : -1;
  if (startIndex < 0) return null;

  for (let i = startIndex; i < RITE_ORDER.length; i++) {
    const rite = RITE_ORDER[i];
    const info = RITE_INFO[rite];
    if (!info || ownsWholeRite(accessRows, rite)) continue;

    const offer = getCompleteRiteOffer(accessRows, rite);
    if (offer) {
      return {
        type: 'complete-rite',
        riteName: info.name,
        missingNames: offer.missingSlugs.map((s) => names[s] ?? PRODUCTS[s]?.name ?? s),
        price: offer.price,
        savings: offer.savings,
        pageUrl: `${marketingUrl}${info.pagePath}`,
      };
    }

    // Owns none of a later Rite: point to it at the bundle price. Owning part of
    // a Rite with no saving to offer leaves nothing useful to say, so move on.
    const components = BUNDLE_CONTENTS[rite];
    const ownsAny = accessRows.some((r) => r.access_granted && components.includes(r.product_slug));
    if (i > startIndex && !ownsAny && PRODUCTS[rite]) {
      return {
        type: 'next-rite',
        riteName: info.name,
        riteNumber: RITE_NUMERALS[i],
        includedNames: components.map((s) => names[s] ?? PRODUCTS[s]?.name ?? s),
        price: PRODUCTS[rite].price,
        pageUrl: `${marketingUrl}${info.pagePath}`,
      };
    }
  }
  return null;
}

export interface SendWelcomeEmailParams {
  to: string;
  name: string;
  productName: string;
  productSlug: string;
  productsGranted: string[];
  /** Supabase user id from grant-access; needed for the offer block. */
  userId?: string;
  /** True for a "complete the Rite" checkout (session.metadata.upgrade === 'complete_rite'). */
  isUpgrade?: boolean;
  /** Slugs the upgrade added (session.metadata.missing). */
  upgradeMissingSlugs?: string[];
}

export interface WelcomeEmailDeps {
  loadAccessRows?: (userId: string) => Promise<AccessRowInput[]>;
  appUrl?: string;
  marketingUrl?: string;
}

/** Resolve everything the template needs. Never throws on the offer lookup. */
export async function buildWelcomeEmailData(
  params: SendWelcomeEmailParams,
  deps: WelcomeEmailDeps = {},
): Promise<WelcomeEmailData> {
  const loadAccessRows = deps.loadAccessRows ?? getUserAccessRows;
  const appUrl = deps.appUrl ?? APP_URL;
  const marketingUrl = deps.marketingUrl ?? MARKETING_URL;

  const { to, name, productName, productSlug, productsGranted } = params;
  const granted = productsGranted.length > 0 ? productsGranted : [productSlug];
  const isMulti = Boolean(BUNDLE_CONTENTS[productSlug]) || granted.length > 1;
  const kind: WelcomeEmailData['kind'] = isMulti ? (params.isUpgrade ? 'upgrade' : 'bundle') : 'single';

  const purchasedRite = findRiteForSlug(productSlug);
  const riteName = purchasedRite ? RITE_INFO[purchasedRite]?.name : undefined;

  const names = await getProductNames(Array.from(new Set([...granted, ...Object.values(BUNDLE_CONTENTS).flat()])));

  let startSlug = kind === 'single' ? productSlug : granted[0];
  if (kind === 'upgrade') {
    const firstNew = (params.upgradeMissingSlugs ?? []).find((s) => granted.includes(s));
    if (firstNew) startSlug = firstNew;
  }

  let next: WelcomeEmailData['next'] = null;
  if (params.userId) {
    try {
      const rows = await loadAccessRows(params.userId);
      next = pickNextBlock(rows, purchasedRite, names, marketingUrl);
    } catch (err: any) {
      console.warn('[welcome-email] offer lookup failed, sending without the offer block:', err?.message);
      next = null;
    }
  }

  return {
    name,
    email: to,
    kind,
    purchaseName: kind === 'single' ? names[productSlug] ?? productName : riteName ?? productName,
    riteName,
    start: {
      slug: startSlug,
      name: names[startSlug] ?? productName,
      duration: PRODUCTS[startSlug]?.estimatedDuration,
    },
    includedNames: kind === 'single' ? [] : granted.map((s) => names[s] ?? s),
    appUrl,
    next,
    founderName: 'Austin',
    businessName: BUSINESS.name && BUSINESS.name !== 'Your Business' ? BUSINESS.name : 'Quantum Strategies',
    replyEmail: BUSINESS.sender.email,
  };
}

/** RFC 2047 encode a header value so a non-ASCII subject survives. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export async function sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<void> {
  const data = await buildWelcomeEmailData(params);
  const email = renderWelcomeEmail(data);

  const credentials = getGmailCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: BUSINESS.sender.email,
  });
  const gmail = google.gmail({ version: 'v1', auth });

  const boundary = `qs-welcome-${Date.now().toString(36)}`;
  const raw = [
    `From: "${BUSINESS.sender.name}" <${BUSINESS.sender.email}>`,
    `To: ${params.to}`,
    `Reply-To: ${BUSINESS.sender.email}`,
    `Subject: ${encodeHeader(email.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    email.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    email.html,
    '',
    `--${boundary}--`,
  ].join('\n');

  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
  console.log('✅ Welcome email sent to:', params.to, `(${data.kind}, next: ${data.next?.type ?? 'none'})`);
}

export async function sendAdminNotification(params: {
  customerEmail: string;
  customerName: string;
  productName: string;
  amount: number;
  sessionId: string;
}): Promise<void> {
  const adminEmails = BUSINESS.adminEmails;
  if (!adminEmails.length) return;

  const credentials = getGmailCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: BUSINESS.sender.email,
  });
  const gmail = google.gmail({ version: 'v1', auth });

  const subject = `New Purchase: ${params.productName} — $${params.amount.toFixed(2)}`;
  const text = `
NEW PURCHASE NOTIFICATION

Product: ${params.productName}
Amount: $${params.amount.toFixed(2)}
Customer: ${params.customerName}
Email: ${params.customerEmail}
Session: ${params.sessionId}

View in Stripe Dashboard:
https://dashboard.stripe.com/payments
`.trim();

  for (const adminEmail of adminEmails) {
    const raw = [
      `From: "${BUSINESS.sender.name}" <${BUSINESS.sender.email}>`,
      `To: ${adminEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      text,
    ].join('\n');

    const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
  }
  console.log('✅ Admin notification sent to:', adminEmails.join(', '));
}
