import { describe, it, expect } from 'vitest';
import { marketingPrecheckAllowed, normalizeCountry } from '../consent-region';

describe('marketingPrecheckAllowed', () => {
  it('pre-ticks for US visitors only', () => {
    expect(marketingPrecheckAllowed('US')).toBe(true);
    expect(marketingPrecheckAllowed('us')).toBe(true);
    expect(marketingPrecheckAllowed(' US ')).toBe(true);
  });

  it('leaves the box unticked for every other country', () => {
    for (const c of ['GB', 'DE', 'FR', 'IE', 'CA', 'AU', 'BR', 'JP', 'KR', 'SG', 'NZ', 'CH', 'MX', 'IN', 'PR']) {
      expect(marketingPrecheckAllowed(c)).toBe(false);
    }
  });

  it('leaves the box unticked when the country is missing or unknown', () => {
    expect(marketingPrecheckAllowed(undefined)).toBe(false);
    expect(marketingPrecheckAllowed(null)).toBe(false);
    expect(marketingPrecheckAllowed('')).toBe(false);
    expect(marketingPrecheckAllowed('XX')).toBe(false);
    expect(marketingPrecheckAllowed('USA')).toBe(false);
  });
});

describe('normalizeCountry', () => {
  it('returns an uppercase two-letter code or null', () => {
    expect(normalizeCountry('de')).toBe('DE');
    expect(normalizeCountry('U1')).toBeNull();
    expect(normalizeCountry('United States')).toBeNull();
    expect(normalizeCountry(undefined)).toBeNull();
  });
});
