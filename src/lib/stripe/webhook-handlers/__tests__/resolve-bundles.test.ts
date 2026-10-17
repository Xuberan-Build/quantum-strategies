import { describe, it, expect, vi } from 'vitest';

const maybeSingle = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

import { resolveProductSlugs, BUNDLE_CONTENTS } from '../grant-access';

describe('resolveProductSlugs', () => {
  it('expands every code-sold bundle to its member products', async () => {
    expect(await resolveProductSlugs('perception-rite-bundle')).toHaveLength(5);
    expect(await resolveProductSlugs('orientation-bundle')).toEqual([
      'personal-alignment', 'business-alignment', 'brand-alignment',
    ]);
    expect(await resolveProductSlugs('declaration-rite-bundle')).toHaveLength(3);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it('never grants a bundle slug as if it were a product', async () => {
    for (const slug of Object.keys(BUNDLE_CONTENTS)) {
      expect(await resolveProductSlugs(slug)).not.toContain(slug);
    }
  });

  it('returns a single product unchanged when the DB has no bundle data', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column does not exist' } });
    expect(await resolveProductSlugs('perception-rite-scan-1')).toEqual(['perception-rite-scan-1']);
  });

  it('honours a DB bundle_products list when present', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { bundle_products: ['a', 'b'] }, error: null });
    expect(await resolveProductSlugs('future-bundle')).toEqual(['a', 'b']);
  });
});
