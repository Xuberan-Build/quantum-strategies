import { describe, it, expect } from 'vitest';
import { safeRedirect } from '../safe-redirect';

describe('safeRedirect', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard/chart', '/dashboard/chart'],
    ['/read/checkout?session=abc#top', '/read/checkout?session=abc#top'],
    ['%2Fdashboard%2Fchart', '/dashboard/chart'],
  ])('allows same-origin path %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    '   ',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'javascript%3Aalert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.example',
    '//evil.example',
    '%2F%2Fevil.example',
    '/\\evil.example',
    '/%5Cevil.example',
    '\\\\evil.example',
    '/\tevil',
    '/%09/evil.example',
    'dashboard',
    '%E0%A4%A', // malformed encoding
  ])('rejects %s', (input) => {
    expect(safeRedirect(input as string | null | undefined)).toBe('/dashboard');
  });

  it('uses the given fallback', () => {
    expect(safeRedirect('//evil', '/dashboard/chart')).toBe('/dashboard/chart');
  });
});
