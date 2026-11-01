import { beforeEach, describe, expect, it, vi } from 'vitest';

// unstable_cache needs the Next runtime; in tests it just calls through.
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const state: { result: { data: { is_active: boolean | null } | null; error: unknown }; calls: string[] } = {
  result: { data: null, error: null },
  calls: [],
};

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from(table: string) {
      state.calls.push(`from:${table}`);
      return {
        select(columns: string) {
          state.calls.push(`select:${columns}`);
          return {
            eq(column: string, value: string) {
              state.calls.push(`eq:${column}=${value}`);
              return { maybeSingle: async () => state.result };
            },
          };
        },
      };
    },
  },
}));

import { fetchReadActive, isReadLive, isReadPreview, type ReadLiveClient } from '../live';

const fakeClient = (result: { data: { is_active: boolean | null } | null; error: unknown }): ReadLiveClient => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }),
});

beforeEach(() => {
  state.result = { data: null, error: null };
  state.calls = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('isReadLive (launch gate)', () => {
  it('is live when perception-read is_active is true', async () => {
    state.result = { data: { is_active: true }, error: null };
    await expect(isReadLive({ env: {} })).resolves.toBe(true);
    expect(state.calls).toEqual(['from:product_definitions', 'select:is_active', 'eq:product_slug=perception-read']);
  });

  it('hides the placements when the product is inactive', async () => {
    state.result = { data: { is_active: false }, error: null };
    await expect(isReadLive({ env: {} })).resolves.toBe(false);
  });

  it('hides the placements when the row is missing', async () => {
    state.result = { data: null, error: null };
    await expect(isReadLive({ env: {} })).resolves.toBe(false);
  });

  it('hides the placements when the lookup errors', async () => {
    state.result = { data: null, error: { message: 'permission denied' } };
    await expect(isReadLive({ env: {} })).resolves.toBe(false);
  });

  it('hides the placements when the lookup throws', async () => {
    await expect(
      isReadLive({
        env: {},
        lookup: async () => {
          throw new Error('network down');
        },
      }),
    ).resolves.toBe(false);
  });

  it('shows the placements with the preview override, without a lookup', async () => {
    const lookup = vi.fn(async () => false);
    await expect(isReadLive({ env: { NEXT_PUBLIC_READ_CTA_PREVIEW: '1' }, lookup })).resolves.toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('ignores the preview override on the production deployment', async () => {
    const lookup = vi.fn(async () => false);
    await expect(
      isReadLive({ env: { NEXT_PUBLIC_READ_CTA_PREVIEW: '1', VERCEL_ENV: 'production' }, lookup }),
    ).resolves.toBe(false);
    expect(lookup).toHaveBeenCalledOnce();
  });

  it('only treats "1" as the preview switch', () => {
    expect(isReadPreview({ NEXT_PUBLIC_READ_CTA_PREVIEW: 'true' })).toBe(false);
    expect(isReadPreview({ NEXT_PUBLIC_READ_CTA_PREVIEW: '0' })).toBe(false);
    expect(isReadPreview({})).toBe(false);
    expect(isReadPreview({ NEXT_PUBLIC_READ_CTA_PREVIEW: '1', VERCEL_ENV: 'preview' })).toBe(true);
  });
});

describe('fetchReadActive', () => {
  it('returns true only for is_active === true', async () => {
    await expect(fetchReadActive(fakeClient({ data: { is_active: true }, error: null }))).resolves.toBe(true);
    await expect(fetchReadActive(fakeClient({ data: { is_active: null }, error: null }))).resolves.toBe(false);
  });

  it('throws on a lookup error so the cache never stores a failure', async () => {
    await expect(fetchReadActive(fakeClient({ data: null, error: { message: 'boom' } }))).rejects.toThrow();
  });
});
