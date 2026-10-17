import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVIDENCE_TIERS, MARKET_RESEARCH_TIERS, parseTiers } from '../evidence';
import { filterHitsByTier, vectorSearch } from '../vector-search';

afterEach(() => vi.unstubAllGlobals());

describe('corpus tiers', () => {
  it('evidence tiers never include market_signal or internal', () => {
    expect(EVIDENCE_TIERS).toEqual(['evidence', 'model', 'lineage']);
    expect(EVIDENCE_TIERS).not.toContain('market_signal');
    expect(MARKET_RESEARCH_TIERS).toContain('market_signal');
  });

  it('parseTiers accepts arrays and comma strings, drops unknown values', () => {
    expect(parseTiers(['evidence', 'bogus', 'market_signal'])).toEqual(['evidence', 'market_signal']);
    expect(parseTiers('evidence, lineage')).toEqual(['evidence', 'lineage']);
    expect(parseTiers(undefined)).toBeNull();
    expect(parseTiers(['nope'])).toBeNull();
  });
});

describe('vectorSearch', () => {
  it('sends no filter_tiers when no tiers are passed (original behaviour)', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await vectorSearch([0.1], 0.45, 5, null);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).not.toHaveProperty('filter_tiers');
  });

  it('passes filter_tiers and drops any hit with another tier', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([{ id: 'a', tier: 'evidence' }, { id: 'b', tier: 'market_signal' }]), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const hits = await vectorSearch([0.1], 0.45, 5, null, EVIDENCE_TIERS);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.filter_tiers).toEqual(['evidence', 'model', 'lineage']);
    expect(hits.map((h) => h.id)).toEqual(['a']);
  });
});

describe('filterHitsByTier', () => {
  it('returns hits unchanged without tiers', async () => {
    const hits = [{ id: 'a' }];
    expect(await filterHitsByTier(hits)).toBe(hits);
  });

  it('looks up unknown tiers and keeps only allowed ones', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ id: 'a', tier: 'lineage' }, { id: 'b', tier: 'market_signal' }]), { status: 200 })));
    const out = await filterHitsByTier([{ id: 'a' }, { id: 'b' }, { id: 'c', tier: 'evidence' }], EVIDENCE_TIERS);
    expect(out.map((h) => [h.id, h.tier])).toEqual([['a', 'lineage'], ['c', 'evidence']]);
  });

  it('fails closed when the lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await filterHitsByTier([{ id: 'a' }, { id: 'c', tier: 'evidence' }], EVIDENCE_TIERS);
    expect(out.map((h) => h.id)).toEqual(['c']);
  });
});
