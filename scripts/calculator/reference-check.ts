/**
 * Regression check: our HD engine vs the published reference charts
 * (scripts/calculator/fixtures/reference-charts.json, sources in
 * brain/research/chart-industry/hd-reference-set.md). Read-only; no network, no DB.
 *
 * Usage: npx tsx scripts/calculator/reference-check.ts [--verbose]
 */
import fs from 'fs';
import path from 'path';
import { birthDataToUtc, getEphemeris, findDesignDate } from '../../src/lib/calculator/ephemeris';
import { buildHumanDesignChart } from '../../src/lib/calculator/human-design';

type Ref = {
  name: string;
  birth: { date: string; time: string; timezone: string; lat: number; lng: number };
  hd: {
    type: string; authority: string; profile: string; definition: string; confidence?: string;
    activations: { personality: Record<string, string>; design: Record<string, string> };
  };
};

const refs: Ref[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/reference-charts.json'), 'utf8'));
const verbose = process.argv.includes('--verbose');

(async () => {
  let fields = 0, fieldOk = 0, acts = 0, actOk = 0;
  const missByPlanet: Record<string, number> = {};
  for (const r of refs) {
    if (/conflict|do not use|exclude/i.test(r.hd.confidence ?? '')) { console.log(`skip  ${r.name} (${r.hd.confidence})`); continue; }
    const bd = { birthDate: r.birth.date, birthTime: r.birth.time, timezone: r.birth.timezone, lat: r.birth.lat, lng: r.birth.lng };
    const utc = birthDataToUtc(bd);
    const natal = await getEphemeris(utc, bd.lat, bd.lng);
    const dd = findDesignDate(utc, natal.planets.sun.tropicalLng);
    const design = await getEphemeris(dd, bd.lat, bd.lng);
    const c = buildHumanDesignChart(natal, design, dd);

    const misses: string[] = [];
    for (const [k, want, got] of [
      ['type', r.hd.type, c.type], ['authority', r.hd.authority, c.authority],
      ['profile', r.hd.profile, c.profile], ['definition', r.hd.definition, c.definition],
    ] as const) {
      fields++;
      if (String(want).toLowerCase() === String(got).toLowerCase()) fieldOk++; else misses.push(`${k} want ${want} got ${got}`);
    }
    for (const [side, ours] of [['personality', c.conscious], ['design', c.unconscious]] as const) {
      for (const [planet, want] of Object.entries(r.hd.activations[side])) {
        const a = (ours as unknown as Record<string, { gate: number; line: number }>)[planet];
        if (!a) continue;
        acts++;
        const got = `${a.gate}.${a.line}`;
        if (got === want) actOk++;
        else { misses.push(`${side[0].toUpperCase()} ${planet} want ${want} got ${got}`); missByPlanet[planet] = (missByPlanet[planet] ?? 0) + 1; }
      }
    }
    console.log(`${misses.length ? 'DIFF' : 'OK  '}  ${r.name}${misses.length ? `: ${verbose ? misses.join('; ') : `${misses.length} differences`}` : ''}`);
  }
  console.log(`\nType/authority/profile/definition: ${fieldOk}/${fields}`);
  console.log(`Activations (gate.line):            ${actOk}/${acts}`);
  console.log(`Misses by planet:`, missByPlanet);
})();
