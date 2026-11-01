/**
 * Launch gate for the Perception Read placements on the public site.
 *
 * The placements (banner, article card, end-of-article block, homepage line, footer
 * link) render only when product_definitions.is_active is true for 'perception-read'.
 * It stays false in production until launch, on purpose.
 *
 *   - Cached for 5 minutes (unstable_cache, tag 'read-live'). A page that reads the gate
 *     revalidates at most every 5 minutes, so flipping is_active shows up within that.
 *   - Any error (missing env, network, RLS, no row) hides the placements. Errors are not
 *     cached, so the next request tries again.
 *   - NEXT_PUBLIC_READ_CTA_PREVIEW=1 forces the placements on for local preview and
 *     Vercel preview builds. It is ignored on the production deployment
 *     (VERCEL_ENV=production), so a stray env var can't launch it early.
 *
 * Uses the service-role client (no cookies), so pages that read it can stay static.
 */
import { unstable_cache } from 'next/cache';
import { READ_PRODUCT_SLUG } from './types';

export const READ_LIVE_REVALIDATE_S = 300;
export const READ_LIVE_TAG = 'read-live';

/** The minimal client surface the lookup needs (lets tests pass a fake). */
export interface ReadLiveClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: { is_active: boolean | null } | null; error: unknown }>;
      };
    };
  };
}

type Env = Record<string, string | undefined>;

/** True when the preview override is set and this isn't the production deployment. */
export function isReadPreview(env: Env = process.env): boolean {
  if (env.NEXT_PUBLIC_READ_CTA_PREVIEW !== '1') return false;
  return env.VERCEL_ENV !== 'production';
}

/** Reads is_active once. Throws on any lookup error so the cache never stores a failure. */
export async function fetchReadActive(client: ReadLiveClient): Promise<boolean> {
  const { data, error } = await client
    .from('product_definitions')
    .select('is_active')
    .eq('product_slug', READ_PRODUCT_SLUG)
    .maybeSingle();
  if (error) {
    if (error instanceof Error) throw error;
    const message = (error as { message?: unknown }).message;
    throw new Error(`read-live lookup failed${typeof message === 'string' ? `: ${message}` : ''}`);
  }
  return data?.is_active === true;
}

async function lookup(): Promise<boolean> {
  // Imported lazily so a missing service key fails inside the try below, not at import.
  const { supabaseAdmin } = await import('@/lib/supabase/server');
  return fetchReadActive(supabaseAdmin as unknown as ReadLiveClient);
}

const cachedLookup = unstable_cache(lookup, ['read-live', READ_PRODUCT_SLUG], {
  revalidate: READ_LIVE_REVALIDATE_S,
  tags: [READ_LIVE_TAG],
});

export interface IsReadLiveOptions {
  env?: Env;
  /** Override the lookup (tests). Defaults to the cached service-role lookup. */
  lookup?: () => Promise<boolean>;
}

/** Should the Perception Read placements render? False on any doubt. */
export async function isReadLive(options: IsReadLiveOptions = {}): Promise<boolean> {
  if (isReadPreview(options.env ?? process.env)) return true;
  try {
    return (await (options.lookup ?? cachedLookup)()) === true;
  } catch (err) {
    console.warn('[read-live] gate lookup failed; hiding Perception Read placements', err instanceof Error ? err.message : err);
    return false;
  }
}
