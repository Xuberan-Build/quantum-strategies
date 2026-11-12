/**
 * Whether the marketing opt-in on the Read email gate may start pre-ticked for a visitor.
 *
 * Founder rule (2026-11-11): pre-tick for US visitors only. Every other country, and a
 * missing or unrecognised country, starts unticked (active opt-in). The country comes from
 * Vercel's `x-vercel-ip-country` header, read server-side only; never trust it from the client.
 */
export function marketingPrecheckAllowed(country: string | null | undefined): boolean {
  return normalizeCountry(country) === 'US';
}

/** Two-letter uppercase ISO code, or null when the value is missing or not a country code. */
export function normalizeCountry(country: string | null | undefined): string | null {
  if (typeof country !== 'string') return null;
  const c = country.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** Vercel's geo header. Absent in local dev, so local dev behaves like an unknown country. */
export const COUNTRY_HEADER = 'x-vercel-ip-country';
