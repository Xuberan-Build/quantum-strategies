import {
  EphemerisResult,
  VedicChart,
  VedicPlanetData,
  PlanetName,
  ZodiacSign,
  Nakshatra,
  DashaPeriod,
} from './types';
import { getLahiriAyanamsa, tropicalToSidereal } from './ayanamsa';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNS: ZodiacSign[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const NAKSHATRAS: Nakshatra[] = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

// Nakshatra lords in the same order as NAKSHATRAS (Ashwini … Revati)
const NAKSHATRA_LORDS: string[] = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu',
  'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus', 'Sun',
  'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu',
  'Jupiter', 'Saturn', 'Mercury',
];

// Vimshottari dasha sequence (fixed) and period lengths in years
const DASHA_SEQUENCE: string[] = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
];
const DASHA_YEARS: Record<string, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

// Degrees per nakshatra and per pada
const DEG_PER_NAKSHATRA = 360 / 27;           // ≈ 13.3333…
const DEG_PER_PADA = 360 / 108;               // ≈ 3.3333…  (4 padas per nakshatra)

// Navamsha starting sign indices for each element group
// Fire: Aries(0), Leo(4), Sagittarius(8)  → start Aries(0)
// Earth: Taurus(1), Virgo(5), Capricorn(9) → start Capricorn(9)
// Air: Gemini(2), Libra(6), Aquarius(10)  → start Libra(6)
// Water: Cancer(3), Scorpio(7), Pisces(11) → start Cancer(3)
const NAVAMSHA_START: Record<number, number> = {
  0: 0, 4: 0, 8: 0,   // Fire → Aries
  1: 9, 5: 9, 9: 9,   // Earth → Capricorn
  2: 6, 6: 6, 10: 6,  // Air → Libra
  3: 3, 7: 3, 11: 3,  // Water → Cancer
};

// Planets we process (in order we want to iterate)
const PLANET_NAMES: PlanetName[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
  'northNode', 'southNode',
];

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Normalize any longitude to [0, 360) */
function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Return ZodiacSign and 0-29.99 degree for a sidereal longitude */
function signAndDegree(siderealLng: number): { sign: ZodiacSign; degree: number } {
  const n = normalizeDeg(siderealLng);
  const signIndex = Math.floor(n / 30);
  return {
    sign: SIGNS[signIndex],
    degree: n % 30,
  };
}

/** Return Nakshatra and pada (1-4) for a sidereal longitude */
function nakshatraAndPada(
  siderealLng: number,
): { nakshatra: Nakshatra; pada: 1 | 2 | 3 | 4 } {
  const n = normalizeDeg(siderealLng);
  const nakshatraIndex = Math.floor(n / DEG_PER_NAKSHATRA);
  const degInNakshatra = n % DEG_PER_NAKSHATRA;
  const pada = (Math.floor(degInNakshatra / DEG_PER_PADA) + 1) as 1 | 2 | 3 | 4;
  return { nakshatra: NAKSHATRAS[nakshatraIndex], pada };
}

/** Add fractional years to a Date, returning a new Date */
function addYears(date: Date, years: number): Date {
  // Use milliseconds for precision across month/year boundaries
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + years * MS_PER_YEAR);
}

// ---------------------------------------------------------------------------
// Vimshottari dasha calculation
// ---------------------------------------------------------------------------

function buildDashas(moonSiderealLng: number, birthUtc: Date): DashaPeriod[] {
  const n = normalizeDeg(moonSiderealLng);

  // 1. Which nakshatra is the Moon in?
  const nakshatraIndex = Math.floor(n / DEG_PER_NAKSHATRA);
  const degInNakshatra = n % DEG_PER_NAKSHATRA;
  const fractionThroughNakshatra = degInNakshatra / DEG_PER_NAKSHATRA;

  // 2. Lord of that nakshatra = first mahadasha lord
  const startLord = NAKSHATRA_LORDS[nakshatraIndex];
  const startIndexInSequence = DASHA_SEQUENCE.indexOf(startLord);

  // 3. Remaining years in the current mahadasha at birth
  const remainingYearsInFirstDasha =
    (1 - fractionThroughNakshatra) * DASHA_YEARS[startLord];

  // 4. Build at least current + 4 more periods (≥ 5 total)
  const periods: DashaPeriod[] = [];
  let cursor = birthUtc;

  for (let i = 0; periods.length < 5; i++) {
    const seqIndex = (startIndexInSequence + i) % DASHA_SEQUENCE.length;
    const lord = DASHA_SEQUENCE[seqIndex];
    const fullYears = DASHA_YEARS[lord];

    let durationYears: number;
    if (i === 0) {
      // First period is the remainder of the ongoing dasha
      durationYears = remainingYearsInFirstDasha;
    } else {
      durationYears = fullYears;
    }

    const end = addYears(cursor, durationYears);
    periods.push({ lord, start: cursor, end });
    cursor = end;
  }

  return periods;
}

// ---------------------------------------------------------------------------
// Navamsha sign for a sidereal longitude
// ---------------------------------------------------------------------------

function navamshaSign(siderealLng: number): ZodiacSign {
  const n = normalizeDeg(siderealLng);
  const signIndex = Math.floor(n / 30);
  const degInSign = n % 30;
  const navamshaIndex = Math.floor(degInSign / (30 / 9));
  const startIndex = NAVAMSHA_START[signIndex];
  const navamshaSignIndex = (startIndex + navamshaIndex) % 12;
  return SIGNS[navamshaSignIndex];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildVedicChart(
  ephemeris: EphemerisResult,
  birthUtc: Date,
): VedicChart {
  // Compute ayanamsa
  const ayanamsa = getLahiriAyanamsa(birthUtc);

  // Convert tropical ASC to sidereal → lagna sign
  const siderealAsc = tropicalToSidereal(ephemeris.ascendant, ayanamsa);
  const lagnaSignIndex = Math.floor(normalizeDeg(siderealAsc) / 30);
  const lagnaSign = SIGNS[lagnaSignIndex];
  const { nakshatra: lagnaNakshatra, pada: lagnaPada } = nakshatraAndPada(siderealAsc);

  // Whole-sign house cusps: each house starts at 0° of its sign
  // House 1 = lagna sign starting degree, house 2 = next sign, etc.
  const houses: number[] = [];
  for (let h = 0; h < 12; h++) {
    houses.push(((lagnaSignIndex + h) * 30) % 360);
  }

  // Build planet data
  const planets: Partial<Record<PlanetName, VedicPlanetData>> = {};
  const navamsha: Partial<Record<PlanetName, ZodiacSign>> = {};

  for (const planetName of PLANET_NAMES) {
    const position = ephemeris.planets[planetName];
    if (!position) continue;

    const siderealLng = tropicalToSidereal(position.tropicalLng, ayanamsa);
    const { sign, degree } = signAndDegree(siderealLng);
    const { nakshatra, pada } = nakshatraAndPada(siderealLng);

    // Whole-sign house: how many signs away from lagna sign?
    const planetSignIndex = Math.floor(normalizeDeg(siderealLng) / 30);
    const house = ((planetSignIndex - lagnaSignIndex + 12) % 12) + 1;

    planets[planetName] = {
      planet: planetName,
      sign,
      degree,
      retrograde: position.retrograde,
      nakshatra,
      pada,
      house,
    };

    navamsha[planetName] = navamshaSign(siderealLng);
  }

  // Vimshottari dashas from Moon's sidereal longitude
  let dashas: DashaPeriod[] = [];
  const moonPosition = ephemeris.planets['moon'];
  if (moonPosition) {
    const moonSidereal = tropicalToSidereal(moonPosition.tropicalLng, ayanamsa);
    dashas = buildDashas(moonSidereal, birthUtc);
  }

  return {
    ayanamsa,
    planets,
    lagna: {
      sign: lagnaSign,
      degree: normalizeDeg(siderealAsc) % 30,
      nakshatra: lagnaNakshatra,
      pada: lagnaPada,
    },
    houses,
    dashas,
    navamsha,
  };
}
