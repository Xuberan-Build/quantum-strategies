/**
 * The Perception Read on the public site: link building and where the banner shows.
 * Pure and client-safe (the banner imports it). The launch gate lives in ./live.ts.
 *
 * Every link sends the UTM keys /read already parses (src/components/read/utm.ts,
 * stored on the session as ReadUtm and sent with `read_view_landing`):
 *   utm_source=site · utm_medium=banner|sidebar|inline|home|footer · utm_content=<page slug>
 *   utm_term=<pillar and tags> on articles, so topic → start rate can be read later.
 */
import { LANDING_LINES } from '@/components/read/copy';

export const READ_PATH = '/read/';

export type ReadCtaMedium = 'banner' | 'sidebar' | 'inline' | 'home' | 'footer';

export interface ReadCtaLink {
  medium: ReadCtaMedium;
  /** The page the link sits on, as a slug (see slugForPath). */
  content?: string;
  /** Topic or pillar tags, joined into utm_term. */
  terms?: readonly (string | null | undefined)[];
}

/** /read parses at most 200 characters per value (utm.ts `clean`). Stay under it. */
const MAX_VALUE = 200;

/** Lower-case, a-z0-9 and dashes only. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * utm_content values that /read reads as a landing line or the manifestation variant
 * (copy.ts LANDING_LINES, utm.ts resolveVariant). A page slug that happens to match one
 * would change what the visitor sees, so it gets a "page-" prefix.
 */
function safeContent(slug: string): string {
  return Object.prototype.hasOwnProperty.call(LANDING_LINES, slug) ? `page-${slug}` : slug;
}

/** "/articles/some-post/" → "articles-some-post". "/" → "home". */
export function slugForPath(pathname: string | null | undefined): string {
  const path = (pathname ?? '/').split(/[?#]/)[0];
  const slug = slugify(path.replace(/\//g, ' '));
  return slug || 'home';
}

/** Tags → "pillar-slug,tag-one,tag-two", deduped, capped at 200 characters. */
export function termFromTags(tags: readonly (string | null | undefined)[] | undefined): string | undefined {
  if (!tags) return undefined;
  const seen: string[] = [];
  for (const tag of tags) {
    if (!tag) continue;
    const slug = slugify(tag);
    if (slug && !seen.includes(slug)) seen.push(slug);
  }
  let out = '';
  for (const slug of seen) {
    const next = out ? `${out},${slug}` : slug;
    if (next.length > MAX_VALUE) break;
    out = next;
  }
  return out || undefined;
}

/** The /read/ link for one placement, with its UTM set. */
export function buildReadHref({ medium, content, terms }: ReadCtaLink): string {
  const params = new URLSearchParams();
  params.set('utm_source', 'site');
  params.set('utm_medium', medium);
  const contentSlug = content ? slugify(content).slice(0, MAX_VALUE) : '';
  if (contentSlug) params.set('utm_content', safeContent(contentSlug));
  const term = termFromTags(terms);
  if (term) params.set('utm_term', term);
  return `${READ_PATH}?${params.toString()}`;
}

/**
 * Paths where the banner never shows: the Read itself, signed-in and admin areas,
 * product experiences, auth, onboarding, unsubscribe and any checkout.
 */
const HIDDEN_PREFIXES = [
  '/read',
  '/dashboard',
  '/admin',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/onboarding',
  '/ledger',
  '/unsubscribe',
  '/api',
];

export function shouldShowBanner(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split(/[?#]/)[0].toLowerCase();
  const segments = path.split('/').filter(Boolean);
  const normalized = `/${segments.join('/')}`;

  if (HIDDEN_PREFIXES.some((p) => normalized === p || normalized.startsWith(`${p}/`))) return false;
  if (segments.includes('checkout')) return false;
  // /products/<slug>/experience and /products/<slug>/interact are in-product screens.
  if (segments[0] === 'products' && (segments.includes('experience') || segments.includes('interact'))) {
    return false;
  }
  return true;
}

/** localStorage key and lifetime for the banner dismissal. */
export const BANNER_DISMISS_KEY = 'qs_read_banner_hidden_until';
export const BANNER_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
/** Attribute set on <html> while the banner is dismissed (CSS hides it before paint). */
export const BANNER_HIDDEN_ATTR = 'data-read-banner';

/**
 * Runs in <head> before the body paints, so a dismissed banner is never drawn and
 * nothing shifts. Kept tiny and wrapped in try/catch (private mode, blocked storage).
 */
export const BANNER_PREPAINT_SCRIPT = `try{var u=Number(localStorage.getItem(${JSON.stringify(
  BANNER_DISMISS_KEY,
)}));if(u&&u>Date.now())document.documentElement.setAttribute(${JSON.stringify(BANNER_HIDDEN_ATTR)},"off")}catch(e){}`;
