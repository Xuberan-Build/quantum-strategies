/**
 * READ-ONLY impact report for the 2026-11-14 Human Design engine correction
 * (gate wheel 301.625° → 302.0°, design arc 88.736° → 88°).
 *
 * For every user with saved birth_data, computes the chart with the old and the new
 * settings and counts what changes. Writes nothing to the database. Prints no emails,
 * names or birth details: only counts and anonymous row numbers.
 *
 * Usage: npx tsx scripts/calculator/impact-report.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { birthDataToUtc, getEphemeris, findDesignDate } from '../../src/lib/calculator/ephemeris';
import { buildHumanDesignChart } from '../../src/lib/calculator/human-design';
import type { HumanDesignChart, HDActivations } from '../../src/lib/calculator/types';

const OLD = { gateStart: 301.625, arc: 88.736 };
const NEW = { gateStart: 302.0, arc: 88 };

type Stored = { date: string; time: string; lat: number; lng: number; timezone: string };

async function hd(stored: Stored, cfg: { gateStart: number; arc: number }): Promise<HumanDesignChart> {
  const bd = { birthDate: stored.date, birthTime: stored.time, timezone: stored.timezone, lat: stored.lat, lng: stored.lng };
  const utc = birthDataToUtc(bd);
  const natal = await getEphemeris(utc, bd.lat, bd.lng);
  const designDate = findDesignDate(utc, natal.planets.sun.tropicalLng, cfg.arc);
  const design = await getEphemeris(designDate, bd.lat, bd.lng);
  return buildHumanDesignChart(natal, design, designDate, { gateStart: cfg.gateStart });
}

function gates(a: HDActivations): string[] {
  return Object.entries(a).map(([k, v]) => `${k}:${v.gate}.${v.line}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const supabase = createClient(url, key);

  const { data, error } = await supabase.from('users').select('birth_data').not('birth_data', 'is', null);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => r.birth_data as Stored).filter((b) => b?.date && b?.time && b?.timezone);
  const counts = { users: rows.length, type: 0, authority: 0, profile: 0, definition: 0, centers: 0, channels: 0, anyGate: 0, unchanged: 0 };
  const gateChangesPerUser: number[] = [];
  const examples: string[] = [];

  for (const [i, b] of rows.entries()) {
    const [o, n] = await Promise.all([hd(b, OLD), hd(b, NEW)]);
    const og = [...gates(o.conscious).map((g) => `P ${g}`), ...gates(o.unconscious).map((g) => `D ${g}`)];
    const ng = [...gates(n.conscious).map((g) => `P ${g}`), ...gates(n.unconscious).map((g) => `D ${g}`)];
    const gateDiffs = og.filter((g, idx) => g !== ng[idx]).length;
    const changed: string[] = [];
    if (o.type !== n.type) { counts.type++; changed.push(`type ${o.type} → ${n.type}`); }
    if (o.authority !== n.authority) { counts.authority++; changed.push(`authority ${o.authority} → ${n.authority}`); }
    if (o.profile !== n.profile) { counts.profile++; changed.push(`profile ${o.profile} → ${n.profile}`); }
    if (o.definition !== n.definition) { counts.definition++; changed.push(`definition ${o.definition} → ${n.definition}`); }
    if (o.definedCenters.slice().sort().join() !== n.definedCenters.slice().sort().join()) { counts.centers++; changed.push('defined centers'); }
    if (o.definedChannels.slice().sort().join() !== n.definedChannels.slice().sort().join()) { counts.channels++; changed.push('channels'); }
    if (gateDiffs > 0) counts.anyGate++;
    if (!changed.length && !gateDiffs) counts.unchanged++;
    gateChangesPerUser.push(gateDiffs);
    examples.push(`  user #${i + 1}: now ${n.type} ${n.profile} ${n.authority} (was ${o.type} ${o.profile}); ${gateDiffs}/26 gate.lines differ${changed.length ? `; ${changed.join('; ')}` : ''}`);
  }

  console.log('\nHD engine correction: impact on saved charts (read-only)\n');
  console.log(`Users with birth data:        ${counts.users}`);
  console.log(`Type changes:                 ${counts.type}`);
  console.log(`Authority changes:            ${counts.authority}`);
  console.log(`Profile changes:              ${counts.profile}`);
  console.log(`Definition changes:           ${counts.definition}`);
  console.log(`Defined-center changes:       ${counts.centers}`);
  console.log(`Channel changes:              ${counts.channels}`);
  console.log(`Any gate.line change:         ${counts.anyGate}`);
  console.log(`Completely unchanged:         ${counts.unchanged}`);
  const avg = gateChangesPerUser.length ? gateChangesPerUser.reduce((a, b) => a + b, 0) / gateChangesPerUser.length : 0;
  console.log(`Avg gate.lines changed/user:  ${avg.toFixed(1)} of 26\n`);
  console.log(examples.join('\n'));
}

main().catch((err) => {
  console.error('impact report failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
