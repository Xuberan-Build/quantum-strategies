import type { ReadUtm } from '@/lib/read/types';

/** Anything with a URLSearchParams-like `get`. */
export interface ParamSource {
  get(name: string): string | null;
}

export const MANIFESTATION_VARIANT = 'manifestation';

const clean = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 200);
  return trimmed || undefined;
};

/**
 * The landing variant (spec v3 §3.5, N10). `?v=manifestation` or
 * `utm_content=method` (the manifestation landing line) both switch it on.
 */
export function resolveVariant(params: ParamSource): string | undefined {
  const v = clean(params.get('v'))?.toLowerCase();
  if (v === MANIFESTATION_VARIANT) return MANIFESTATION_VARIANT;
  if (clean(params.get('utm_content'))?.toLowerCase() === 'method') return MANIFESTATION_VARIANT;
  return undefined;
}

export function parseUtm(params: ParamSource): ReadUtm {
  const utm: ReadUtm = {
    source: clean(params.get('utm_source')),
    medium: clean(params.get('utm_medium')),
    campaign: clean(params.get('utm_campaign')),
    content: clean(params.get('utm_content')),
    term: clean(params.get('utm_term')),
    variant: resolveVariant(params),
  };
  return Object.fromEntries(Object.entries(utm).filter(([, v]) => v !== undefined)) as ReadUtm;
}

/** Plain-object search params (server page props) to a ParamSource. */
export function paramsFromRecord(record: Record<string, string | string[] | undefined>): ParamSource {
  return {
    get(name) {
      const value = record[name];
      if (Array.isArray(value)) return value[0] ?? null;
      return value ?? null;
    },
  };
}

/** Keep the UTM set and variant when moving from the landing page to the flow. */
export function carryQuery(params: ParamSource): string {
  const keep = ['v', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const out = new URLSearchParams();
  for (const key of keep) {
    const value = clean(params.get(key));
    if (value) out.set(key, value);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}
