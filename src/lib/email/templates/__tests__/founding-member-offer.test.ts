import { describe, it, expect } from 'vitest';
import {
  getFoundingInviteEmail,
  getFoundingValueEmail,
  getFoundingDeadlineEmail,
  type FoundingEmailData,
} from '../founding-member-offer';

const base: FoundingEmailData = {
  name: 'Sam Example',
  price: 60,
  credit: 0,
  perceptionDone: 2,
  orientationDone: 0,
  declarationDone: 0,
  nextProductName: 'Boundary & Burnout',
  closesLabel: 'Sunday, November 15',
  offerUrl: 'https://app.example.test/dashboard/founding',
};

const all = (d: FoundingEmailData) => [getFoundingInviteEmail(d), getFoundingValueEmail(d), getFoundingDeadlineEmail(d)];

describe('founding member emails', () => {
  it('uses the first name, the price and the offer link', () => {
    for (const e of all(base)) {
      expect(e.text).toContain('Hi Sam,');
      expect(e.text).toContain('$60');
      expect(e.text).toContain(base.offerUrl);
      expect(e.html).toContain(base.offerUrl);
    }
  });

  it('shows the credit when they have paid before', () => {
    const e = getFoundingInviteEmail({ ...base, price: 43, credit: 17 });
    expect(e.text).toContain("You've already paid $17, so your price is $43.");
  });

  it('nudges people stalled in Rite I and names the next scan', () => {
    const e = getFoundingValueEmail(base);
    expect(e.subject).toBe('Where most of the beta got stuck');
    expect(e.text).toContain("You've done 2 of the 5 Perception scans.");
    expect(e.text).toContain('Boundary & Burnout');
    expect(e.html).toContain('Boundary &amp; Burnout');
  });

  it('switches the nudge once Rite I is done', () => {
    const e = getFoundingValueEmail({ ...base, perceptionDone: 5, orientationDone: 1, nextProductName: null });
    expect(e.subject).toBe('What comes after Rite I');
    expect(e.text).toContain("You've finished Rite I");
  });

  it('falls back to "there" with no name', () => {
    expect(getFoundingDeadlineEmail({ ...base, name: null }).text).toContain('Hi there,');
  });

  it('has no em-dashes or exclamation marks (tonality rules)', () => {
    for (const e of all(base)) {
      expect(e.text).not.toMatch(/—/);
      expect(e.text).not.toMatch(/!/);
      expect(e.subject).not.toMatch(/[—!]/);
    }
  });
});
