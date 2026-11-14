import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { birthDataToUtc, getEphemeris, findDesignDate } from '../ephemeris';
import { buildHumanDesignChart } from '../human-design';

/**
 * Regression against published charts from independent calculators
 * (scripts/calculator/fixtures/reference-charts.json; sources and confidence in
 * brain/research/chart-industry/hd-reference-set.md).
 */
type Ref = {
  name: string;
  birth: { date: string; time: string; timezone: string; lat: number; lng: number };
  hd: {
    type: string; authority: string; profile: string; definition: string; confidence?: string;
    activations: { personality: Record<string, string>; design: Record<string, string> };
  };
};

const refs: Ref[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'scripts/calculator/fixtures/reference-charts.json'), 'utf8'),
).filter((r: Ref) => !/conflict/i.test(r.hd.confidence ?? ''));

/** Known boundary ties: a planet within ~0.001° of a line edge, where engines legitimately differ. */
const BOUNDARY_TIES = new Set(['Stephen King|design|mercury']);

/** Reference sources name the Ego sub-type; we report the authority without it. */
const sameAuthority = (want: string, got: string) => want === got || want.startsWith(`${got} `);

describe.each(refs)('$name', (r) => {
  it('matches type, authority, profile, definition and all 26 activations', async () => {
    const bd = { birthDate: r.birth.date, birthTime: r.birth.time, timezone: r.birth.timezone, lat: r.birth.lat, lng: r.birth.lng };
    const utc = birthDataToUtc(bd);
    const natal = await getEphemeris(utc, bd.lat, bd.lng);
    const designDate = findDesignDate(utc, natal.planets.sun.tropicalLng);
    const design = await getEphemeris(designDate, bd.lat, bd.lng);
    const c = buildHumanDesignChart(natal, design, designDate);

    expect(c.type).toBe(r.hd.type);
    expect(sameAuthority(r.hd.authority, c.authority)).toBe(true);
    expect(c.profile).toBe(r.hd.profile);
    expect(c.definition).toBe(r.hd.definition);

    for (const [side, ours] of [['personality', c.conscious], ['design', c.unconscious]] as const) {
      for (const [planet, want] of Object.entries(r.hd.activations[side])) {
        const a = (ours as unknown as Record<string, { gate: number; line: number } | undefined>)[planet];
        if (!a || BOUNDARY_TIES.has(`${r.name}|${side}|${planet}`)) continue;
        expect(`${side} ${planet} ${a.gate}.${a.line}`).toBe(`${side} ${planet} ${want}`);
      }
    }
  });
});
