import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }),
  },
}));
vi.mock('@/lib/pricing/complete-the-rite-server', () => ({
  getUserAccessRows: vi.fn(async () => {
    throw new Error('default loader must not be used in tests');
  }),
}));
vi.mock('googleapis', () => ({ google: {} }));

import { buildWelcomeEmailData, pickNextBlock } from '../send-welcome-email';
import { renderWelcomeEmail, type RenderedEmail } from '@/lib/email/templates/welcome-email';
import type { AccessRowInput } from '@/lib/pricing/complete-the-rite';

const APP = 'https://app.example.com';
const MKT = 'https://www.example.com';

const row = (slug: string, extra: Partial<AccessRowInput> = {}): AccessRowInput => ({
  product_slug: slug,
  access_granted: true,
  amount_paid: 3,
  stripe_session_id: `cs_${slug}`,
  purchase_source: 'single',
  bundle_slug: null,
  ...extra,
});

/** Writes rendered samples for review when WELCOME_EMAIL_SAMPLES_DIR is set. */
function maybeWriteSample(name: string, email: RenderedEmail) {
  const dir = process.env.WELCOME_EMAIL_SAMPLES_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.html`), email.html);
  fs.writeFileSync(path.join(dir, `${name}.txt`), `Subject: ${email.subject}\nPreheader: ${email.preheader}\n\n${email.text}\n`);
}

/** Voice rules from brain/content/tonality.md and language.md that must hold in every render. */
function expectCleanVoice(email: RenderedEmail) {
  const all = `${email.subject}\n${email.preheader}\n${email.text}`;
  expect(all).not.toMatch(/—|–/); // no em or en dashes
  expect(all).not.toMatch(/!/); // no exclamation marks in copy
  expect(all.toLowerCase()).not.toMatch(/frequency|vibration|unlock|game.?changer|level up|journey|transform/);
}

describe('welcome email', () => {
  it('single product: start button deep-links to the experience and shows the complete-the-Rite offer', async () => {
    const data = await buildWelcomeEmailData(
      {
        to: 'buyer@example.com',
        name: 'Jamie Rivera',
        productName: 'Signal Awareness',
        productSlug: 'perception-rite-scan-1',
        productsGranted: ['perception-rite-scan-1'],
        userId: 'user-1',
      },
      { loadAccessRows: async () => [row('perception-rite-scan-1')], appUrl: APP, marketingUrl: MKT },
    );
    const email = renderWelcomeEmail(data);
    maybeWriteSample('single-with-offer', email);

    expect(email.subject).toBe('Signal Awareness is ready. It takes about 15-20 minutes.');
    expect(email.html).toContain('Hi Jamie,');
    expect(email.html).toContain('>Start Signal Awareness</a>');

    // Exactly one primary button
    expect(email.html.match(/class="button"/g)).toHaveLength(1);

    const start = `${APP}/products/perception-rite-scan-1/experience?utm_source=email&amp;utm_medium=transactional&amp;utm_campaign=welcome&amp;utm_content=start_button`;
    expect(email.html).toContain(start);
    expect(email.text).toContain(start.replace(/&amp;/g, '&'));
    // P.S. repeats the start link
    expect(email.text).toMatch(/P\.S\. .*\/products\/perception-rite-scan-1\/experience\?.*utm_content=ps_link/);

    // Offer: paid $3 for scan 1, bundle $12 → rest for $10, saves $2 versus 4 × $3
    expect(data.next).toMatchObject({ type: 'complete-rite', riteName: 'Perception', price: 10, savings: 2 });
    expect(email.text).toContain('Complete Perception for $10');
    expect(email.text).toContain("That's $2 less than buying them one by one.");
    expect(email.html).toContain(
      `${MKT}/products/perception?utm_source=email&amp;utm_medium=transactional&amp;utm_campaign=welcome&amp;utm_content=complete_rite#bundle`,
    );
    expect(email.text).toContain('Value Pattern Decoder');

    expectCleanVoice(email);
  });

  it('bundle: confirms every product, starts the first one, points to the next Rite', async () => {
    const granted = ['perception-rite-scan-1', 'perception-rite-scan-2', 'perception-rite-scan-3', 'perception-rite-scan-4', 'perception-rite-scan-5'];
    const data = await buildWelcomeEmailData(
      {
        to: 'buyer@example.com',
        name: 'there',
        productName: 'Perception Rite Bundle',
        productSlug: 'perception-rite-bundle',
        productsGranted: granted,
        userId: 'user-2',
      },
      {
        loadAccessRows: async () =>
          granted.map((s) => row(s, { amount_paid: 12, stripe_session_id: 'cs_b', purchase_source: 'bundle', bundle_slug: 'perception-rite-bundle' })),
        appUrl: APP,
        marketingUrl: MKT,
      },
    );
    const email = renderWelcomeEmail(data);
    maybeWriteSample('bundle-next-rite', email);

    expect(data.kind).toBe('bundle');
    expect(email.subject).toBe('Perception is yours. Start with Signal Awareness.');
    expect(email.html).toContain('Hi,');
    expect(email.text).toContain('Signal Awareness, Value Pattern Decoder, Boundary & Burnout, Money Signal and Competence Mapping');
    expect(email.html).toContain(`${APP}/products/perception-rite-scan-1/experience?`);

    expect(data.next).toMatchObject({ type: 'next-rite', riteName: 'Orientation', riteNumber: 'II', price: 17 });
    expect(email.text).toContain('Next: Rite II, Orientation');
    expect(email.html).toContain(`${MKT}/products/orientation?utm_source=email&amp;utm_medium=transactional&amp;utm_campaign=welcome&amp;utm_content=next_rite#bundle`);
    expect(email.text).not.toContain('Complete Perception');

    expectCleanVoice(email);
  });

  it('upgrade: starts the first newly added product', async () => {
    const data = await buildWelcomeEmailData(
      {
        to: 'buyer@example.com',
        name: 'Sam',
        productName: 'Complete Orientation Bundle',
        productSlug: 'orientation-bundle',
        productsGranted: ['personal-alignment', 'business-alignment', 'brand-alignment'],
        userId: 'user-3',
        isUpgrade: true,
        upgradeMissingSlugs: ['business-alignment', 'brand-alignment'],
      },
      { loadAccessRows: async () => [], appUrl: APP, marketingUrl: MKT },
    );
    const email = renderWelcomeEmail(data);
    expect(data.kind).toBe('upgrade');
    expect(email.subject).toBe('You own all of Orientation now. Next up: Business Alignment Orientation.');
    expect(email.html).toContain('/products/business-alignment/experience?');
  });

  it('offer lookup failure: still renders, with no offer block', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = await buildWelcomeEmailData(
      {
        to: 'buyer@example.com',
        name: 'Jamie',
        productName: 'Signal Awareness',
        productSlug: 'perception-rite-scan-1',
        productsGranted: ['perception-rite-scan-1'],
        userId: 'user-1',
      },
      { loadAccessRows: async () => { throw new Error('db timeout'); }, appUrl: APP, marketingUrl: MKT },
    );
    const email = renderWelcomeEmail(data);
    maybeWriteSample('single-offer-lookup-failed', email);

    expect(data.next).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(email.html).toContain('>Start Signal Awareness</a>');
    expect(email.html).not.toContain('class="next"');
    expect(email.text).not.toMatch(/Complete Perception|utm_content=complete_rite|utm_content=next_rite/);
    warn.mockRestore();
  });

  it('escapes customer-supplied names', () => {
    const email = renderWelcomeEmail({
      name: '<script>x</script>',
      email: 'a@b.co',
      kind: 'single',
      purchaseName: 'Money Signal',
      start: { slug: 'perception-rite-scan-4', name: 'Money Signal' },
      includedNames: [],
      appUrl: APP,
    });
    expect(email.html).not.toContain('<script>x</script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});

describe('pickNextBlock', () => {
  const names = {};
  it('returns nothing after the last Rite', () => {
    const rows = ['declaration-rite-life-vision', 'declaration-rite-business-model', 'declaration-rite-strategic-path'].map((s) => row(s));
    expect(pickNextBlock(rows, 'declaration-rite-bundle', names, MKT)).toBeNull();
  });

  it('offers to complete the next Rite when the buyer already owns part of it', () => {
    const rows = [
      ...['perception-rite-scan-1', 'perception-rite-scan-2', 'perception-rite-scan-3', 'perception-rite-scan-4', 'perception-rite-scan-5'].map((s) =>
        row(s, { amount_paid: 12, stripe_session_id: 'cs_b', bundle_slug: 'perception-rite-bundle', purchase_source: 'bundle' }),
      ),
      row('personal-alignment', { amount_paid: 7 }),
    ];
    expect(pickNextBlock(rows, 'perception-rite-bundle', names, MKT)).toMatchObject({ type: 'complete-rite', riteName: 'Orientation' });
  });
});
