import { beforeAll, describe, expect, it } from 'vitest';
import { renderFounderDigest, renderProgressEmail, sortForCalls } from '../templates';
import { verifyOptOut } from '../links';
import type { Decision } from '../schedule';
import { daysAgo, owned, snap } from './fixtures';

const ctx = { appUrl: 'https://quantumstrategies.online', businessName: 'Quantum Strategies', founderName: 'Austin', postalAddress: '1 Test St, Town, CA' };
const KINDS: Decision[] = [
  { kind: 'reentry', key: 'reentry' },
  { kind: 'nudge4', key: 'nudge4:x' },
  { kind: 'nudge10', key: 'nudge10:x' },
  { kind: 'weekly', key: 'weekly:x' },
  { kind: 'complete', key: 'complete:perception', rite: 'perception' },
];

beforeAll(() => {
  process.env.READ_LINK_SECRET = 'test-secret';
});

describe('renderProgressEmail', () => {
  const started = snap({ access: owned({ 'perception-rite-scan-1': daysAgo(20) }), lastSessionAt: daysAgo(20) });

  it.each(KINDS)('$kind: no em dashes, has the next step, a working opt-out link and the address', (d) => {
    const e = renderProgressEmail(d, started, ctx);
    for (const part of [e.subject, e.text, e.html]) expect(part).not.toMatch(/—/);
    expect(e.text).toContain('/products/perception-rite-scan-2/experience');
    expect(e.text).toContain('1 Test St, Town, CA');
    const token = new URL(e.text.match(/Stop progress emails: (\S+)/)![1]).searchParams.get('t');
    expect(verifyOptOut(token)).toEqual({ userId: started.user.id, topic: 'progress' });
  });

  it('uses the first name and escapes it in HTML', () => {
    const e = renderProgressEmail({ kind: 'weekly', key: 'w' }, snap({ user: { ...started.user, name: '<b>Al</b> Smith' } }), ctx);
    expect(e.html).toContain('&lt;b&gt;Al&lt;/b&gt;');
    expect(e.html).not.toContain('<b>Al</b>');
  });

  it('speaks to people who have not started', () => {
    const e = renderProgressEmail({ kind: 'reentry', key: 'reentry' }, snap(), ctx);
    expect(e.subject).toBe('Pat, your first step in the Rites');
    expect(e.text).not.toContain('Your progress');
  });
});

describe('renderFounderDigest', () => {
  it('lists closest-to-finishing first, with contact details and the admin link', () => {
    const near = snap({ user: { ...snap().user, id: '22222222-2222-4222-8222-222222222222', name: 'Near One', phone: '555 0100' }, access: owned({ 'perception-rite-scan-1': daysAgo(9), 'perception-rite-scan-2': daysAgo(9) }), lastSessionAt: daysAgo(9) });
    const far = snap({ prefs: { progress: false, newsletter: true } });
    expect(sortForCalls([far, near])[0]).toBe(near);

    const e = renderFounderDigest([far, near], ctx);
    expect(e.subject).toBe('2 people to call');
    expect(e.text.indexOf('Near One')).toBeLessThan(e.text.indexOf('Pat Doe'));
    expect(e.text).toContain('555 0100');
    expect(e.text).toContain('/admin/users/22222222-2222-4222-8222-222222222222');
    expect(e.text).toContain('Opted out of progress emails');
  });
});
