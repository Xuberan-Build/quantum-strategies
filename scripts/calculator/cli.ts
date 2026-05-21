import * as fs from 'fs';
import * as path from 'path';
import { calculateChart } from './index';
import { BirthData, WesternPlanetData, VedicPlanetData } from './types';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        // boolean flag
        result[key] = true;
      } else {
        result[key] = next;
        i++;
      }
    }
  }
  return result;
}

function requireArg(args: Record<string, string | boolean>, key: string): string {
  const val = args[key];
  if (!val || typeof val !== 'string') {
    console.error(`Error: --${key} is required`);
    process.exit(1);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const SIGN_SYMBOLS: Record<string, string> = {
  Aries: 'Ari', Taurus: 'Tau', Gemini: 'Gem', Cancer: 'Can',
  Leo: 'Leo', Virgo: 'Vir', Libra: 'Lib', Scorpio: 'Sco',
  Sagittarius: 'Sag', Capricorn: 'Cap', Aquarius: 'Aqu', Pisces: 'Pis',
};

function formatDegree(deg: number): string {
  const d = Math.floor(deg);
  const mFull = (deg - d) * 60;
  const m = Math.floor(mFull);
  return `${d}°${String(m).padStart(2, '0')}'`;
}

function printWesternChart(western: import('./types').WesternChart): void {
  console.log('\n=== WESTERN CHART ===');
  const PLANET_ORDER: Array<import('./types').PlanetName> = [
    'sun', 'moon', 'mercury', 'venus', 'mars',
    'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
    'northNode', 'chiron',
  ];
  for (const name of PLANET_ORDER) {
    const p = western.planets[name] as WesternPlanetData | undefined;
    if (!p) continue;
    const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1');
    const retro = p.retrograde ? ' (R)' : '';
    console.log(`${label.padEnd(12)}: ${formatDegree(p.degree)} ${p.sign}${retro} (house ${p.house})`);
  }
  // Ascendant lives in houses[0] (whole-sign cusp 0 = Asc)
  if (western.houses.length > 0) {
    const ascDeg = western.houses[0];
    // Derive sign from degree
    const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                   'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const ascSign = signs[Math.floor(ascDeg / 30)];
    const ascWithin = ascDeg % 30;
    console.log(`${'Ascendant'.padEnd(12)}: ${formatDegree(ascWithin)} ${ascSign}`);
  }
}

function printVedicChart(vedic: import('./types').VedicChart): void {
  console.log('\n=== VEDIC CHART ===');
  console.log(`Ayanamsa    : ${vedic.ayanamsa.toFixed(4)}°`);
  console.log(`Lagna       : ${formatDegree(vedic.lagna.degree)} ${vedic.lagna.sign} | ${vedic.lagna.nakshatra} pada ${vedic.lagna.pada}`);
  const PLANET_ORDER: Array<import('./types').PlanetName> = [
    'sun', 'moon', 'mercury', 'venus', 'mars',
    'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
    'northNode', 'chiron',
  ];
  for (const name of PLANET_ORDER) {
    const p = vedic.planets[name] as VedicPlanetData | undefined;
    if (!p) continue;
    const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1');
    const retro = p.retrograde ? ' (R)' : '';
    console.log(`${label.padEnd(12)}: ${formatDegree(p.degree)} ${p.sign}${retro} | ${p.nakshatra} pada ${p.pada} (house ${p.house})`);
  }
}

function printHumanDesignChart(hd: import('./types').HumanDesignChart): void {
  console.log('\n=== HUMAN DESIGN ===');
  console.log(`Type        : ${hd.type}`);
  console.log(`Authority   : ${hd.authority}`);
  console.log(`Profile     : ${hd.profile}`);
  console.log(`Definition  : ${hd.definition}`);
  console.log(`Defined Centers : ${hd.definedCenters.join(', ')}`);

  const formatActivations = (act: import('./types').HDActivations): string => {
    return Object.entries(act)
      .map(([planet, ga]) => {
        const label = planet.charAt(0).toUpperCase() + planet.slice(1);
        return `${label} ${ga.gate}.${ga.line}`;
      })
      .join(', ');
  };

  console.log(`Conscious Gates   : ${formatActivations(hd.conscious)}`);
  console.log(`Unconscious Gates : ${formatActivations(hd.unconscious)}`);

  if (hd.definedChannels.length > 0) {
    console.log(`Defined Channels  : ${hd.definedChannels.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Fixture validation
// ---------------------------------------------------------------------------

interface FixtureKnown {
  western?: {
    sun?: { sign?: string; degree?: number };
    moon?: { sign?: string };
    ascendant?: { sign?: string };
    mercury?: { sign?: string };
    venus?: { sign?: string };
    mars?: { sign?: string };
  };
  humanDesign?: {
    type?: string;
    authority?: string;
    profile?: string;
    definition?: string;
    _uncertain?: boolean;
  };
}

interface Fixture {
  input: Record<string, string | number>;
  known: FixtureKnown & { notes?: string };
}

function runValidation(name: string, result: import('./types').ChartResult): void {
  const fixturePath = path.join(__dirname, 'fixtures', `${name}.json`);
  if (!fs.existsSync(fixturePath)) {
    console.log(`\nNo fixture found for "${name}" at ${fixturePath} — skipping validation.`);
    return;
  }

  const fixture: Fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const known = fixture.known;

  console.log(`\n=== VALIDATION: ${name} ===`);

  let passed = 0;
  let failed = 0;

  function assert(label: string, actual: string | undefined, expected: string | undefined, uncertain = false): void {
    if (!expected) return; // no expected value, skip
    const match = actual?.toLowerCase() === expected.toLowerCase();
    const uncertainTag = uncertain ? ' [uncertain]' : '';
    if (match) {
      console.log(`  PASS  ${label}: "${actual}"${uncertainTag}`);
      passed++;
    } else {
      console.log(`  FAIL  ${label}: expected "${expected}", got "${actual}"${uncertainTag}`);
      failed++;
    }
  }

  // Western assertions
  if (known.western) {
    const sun = result.western.planets['sun'];
    assert('Sun sign', sun?.sign, known.western.sun?.sign);

    const moon = result.western.planets['moon'];
    assert('Moon sign', moon?.sign, known.western.moon?.sign);

    // Ascendant from house cusp
    if (known.western.ascendant?.sign && result.western.houses.length > 0) {
      const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                     'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
      const ascSign = signs[Math.floor(result.western.houses[0] / 30)];
      assert('Ascendant sign', ascSign, known.western.ascendant.sign);
    }

    const mercury = result.western.planets['mercury'];
    assert('Mercury sign', mercury?.sign, known.western.mercury?.sign);

    const venus = result.western.planets['venus'];
    assert('Venus sign', venus?.sign, known.western.venus?.sign);

    const mars = result.western.planets['mars'];
    assert('Mars sign', mars?.sign, known.western.mars?.sign);
  }

  // Human Design assertions
  if (known.humanDesign) {
    const uncertain = known.humanDesign._uncertain === true;
    assert('HD type', result.humanDesign.type, known.humanDesign.type, uncertain);
    assert('HD authority', result.humanDesign.authority, known.humanDesign.authority, uncertain);
    assert('HD profile', result.humanDesign.profile, known.humanDesign.profile, uncertain);
    if (known.humanDesign.definition) {
      assert('HD definition', result.humanDesign.definition, known.humanDesign.definition, uncertain);
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const date = requireArg(args, 'date');
  const time = requireArg(args, 'time');
  const tz = requireArg(args, 'tz');
  const lat = requireArg(args, 'lat');
  const lng = requireArg(args, 'lng');
  const name = typeof args['name'] === 'string' ? args['name'] : undefined;
  const validate = args['validate'] === true;

  const birthData: BirthData = {
    birthDate: date,
    birthTime: time,
    timezone: tz,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
  };

  let result: import('./types').ChartResult;
  try {
    result = await calculateChart(birthData);
  } catch (err) {
    console.error('Error calculating chart:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Full JSON output
  console.log(JSON.stringify(result, null, 2));

  // Human-readable summaries
  printWesternChart(result.western);
  printVedicChart(result.vedic);
  printHumanDesignChart(result.humanDesign);

  // Fixture validation
  if (validate && name) {
    runValidation(name, result);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
