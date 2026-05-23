import type {
  EphemerisResult,
  PlanetName,
  WesternChart,
  WesternPlanetData,
  ZodiacSign,
  Dignity,
  Aspect,
} from './types';
import { norm360, SIGNS } from './utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Planets that participate in aspect calculation (ascendant treated as a
// virtual point — its degree comes from ephemeris.ascendant).
const ASPECT_PLANETS: PlanetName[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northNode',
];

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Sign index (0–11) for a tropical longitude. */
function signIndex(lng: number): number {
  return Math.floor(norm360(lng) / 30);
}

/** Degree within the sign (0–29.999…). */
function degreeInSign(lng: number): number {
  return norm360(lng) % 30;
}

/** Smallest angular difference between two longitudes. */
function angularDiff(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

// ---------------------------------------------------------------------------
// Dignity
// ---------------------------------------------------------------------------

// Map sign index → dignities for each planet.
// Outer planets / nodes / chiron are always 'peregrine'.

const DOMICILE: Partial<Record<PlanetName, number[]>> = {
  sun:     [4],           // Leo
  moon:    [3],           // Cancer
  mercury: [2, 5],        // Gemini, Virgo
  venus:   [1, 6],        // Taurus, Libra
  mars:    [0, 7],        // Aries, Scorpio
  jupiter: [8, 11],       // Sagittarius, Pisces
  saturn:  [9, 10],       // Capricorn, Aquarius
};

const EXALTATION: Partial<Record<PlanetName, number>> = {
  sun:       0,   // Aries
  moon:      1,   // Taurus
  mercury:   5,   // Virgo
  venus:     11,  // Pisces
  mars:      9,   // Capricorn
  jupiter:   3,   // Cancer
  saturn:    6,   // Libra
  northNode: 2,   // Gemini
};

// Planets for which classical dignities apply.
const CLASSICAL_PLANETS = new Set<PlanetName>([
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'northNode',
]);

function getPlanetDignity(planet: PlanetName, lng: number): Dignity {
  if (!CLASSICAL_PLANETS.has(planet)) return 'peregrine';

  const sIdx = signIndex(lng);

  // Domicile
  const domicileSigns = DOMICILE[planet];
  if (domicileSigns && domicileSigns.includes(sIdx)) return 'domicile';

  // Exaltation
  const exaltSign = EXALTATION[planet];
  if (exaltSign !== undefined && exaltSign === sIdx) return 'exaltation';

  // Detriment (opposite of domicile)
  if (domicileSigns) {
    const detrimentSigns = domicileSigns.map(s => (s + 6) % 12);
    if (detrimentSigns.includes(sIdx)) return 'detriment';
  }

  // Fall (opposite of exaltation)
  if (exaltSign !== undefined) {
    if ((exaltSign + 6) % 12 === sIdx) return 'fall';
  }

  return 'peregrine';
}

// ---------------------------------------------------------------------------
// House systems
// ---------------------------------------------------------------------------

/** Build 12 house cusps using the Whole Sign system.
 *  Returns an array where index 0 = cusp of house 1, etc.
 */
function wholeSignCusps(ascendant: number): number[] {
  const ascSignIdx = signIndex(ascendant);
  const cusps: number[] = [];
  for (let i = 0; i < 12; i++) {
    cusps.push(((ascSignIdx + i) % 12) * 30);
  }
  return cusps;
}

/** Build 12 house cusps using a Placidus/Porphyry hybrid.
 *  Houses 1, 4, 7, 10 are the angles; intermediate cusps via Porphyry.
 */
function placidusHybridCusps(ascendant: number, midheaven: number): number[] {
  const asc = norm360(ascendant);
  const mc  = norm360(midheaven);
  const ic  = norm360(mc + 180);
  const dsc = norm360(asc + 180);

  // Arc from MC to ASC going in the direction of increasing longitude.
  // We need the arc that represents the upper-hemisphere arc (MC→ASC).
  // Porphyry simply divides each quadrant into thirds.

  const h11 = norm360(mc  + angularArcSigned(mc,  asc) / 3);
  const h12 = norm360(mc  + angularArcSigned(mc,  asc) * 2 / 3);
  const h2  = norm360(asc + angularArcSigned(asc, ic)  / 3);
  const h3  = norm360(asc + angularArcSigned(asc, ic)  * 2 / 3);
  const h5  = norm360(ic  + angularArcSigned(ic,  dsc) / 3);
  const h6  = norm360(ic  + angularArcSigned(ic,  dsc) * 2 / 3);
  const h8  = norm360(dsc + angularArcSigned(dsc, mc)  / 3);
  const h9  = norm360(dsc + angularArcSigned(dsc, mc)  * 2 / 3);

  // cusps[i] = cusp of house (i+1)
  return [
    asc,  // house 1
    h2,   // house 2
    h3,   // house 3
    ic,   // house 4
    h5,   // house 5
    h6,   // house 6
    dsc,  // house 7
    h8,   // house 8
    h9,   // house 9
    mc,   // house 10
    h11,  // house 11
    h12,  // house 12
  ];
}

/**
 * Returns the signed forward arc (in degrees) from `from` to `to`
 * travelling in the direction of increasing longitude.
 * Result is always in (0, 360].
 */
function angularArcSigned(from: number, to: number): number {
  const diff = norm360(to - from);
  return diff === 0 ? 360 : diff;
}

// ---------------------------------------------------------------------------
// House placement
// ---------------------------------------------------------------------------

/** Return the house number (1–12) that a given longitude falls in. */
function housePlacement(lng: number, cusps: number[]): number {
  const normalised = norm360(lng);
  // Iterate through houses; a planet is in house N if it is >= cusp[N-1]
  // and < cusp[N % 12].
  for (let i = 0; i < 12; i++) {
    const cuspStart = cusps[i];
    const cuspEnd   = cusps[(i + 1) % 12];

    if (cuspStart <= cuspEnd) {
      // Normal (no wrap-around)
      if (normalised >= cuspStart && normalised < cuspEnd) {
        return i + 1;
      }
    } else {
      // Wrap-around: the house spans 0°
      if (normalised >= cuspStart || normalised < cuspEnd) {
        return i + 1;
      }
    }
  }
  // Fallback (should not happen with valid cusps)
  return 1;
}

// ---------------------------------------------------------------------------
// Aspect calculation
// ---------------------------------------------------------------------------

interface AspectDef {
  type: Aspect['type'];
  angle: number;
  baseOrb: number;
}

const ASPECT_DEFS: AspectDef[] = [
  { type: 'conjunction', angle: 0,   baseOrb: 8 },
  { type: 'sextile',     angle: 60,  baseOrb: 4 },
  { type: 'square',      angle: 90,  baseOrb: 7 },
  { type: 'trine',       angle: 120, baseOrb: 7 },
  { type: 'opposition',  angle: 180, baseOrb: 8 },
];

const LUMINARIES = new Set<PlanetName>(['sun', 'moon']);

function getOrb(aspectDef: AspectDef, p1: PlanetName, p2: PlanetName): number {
  if (aspectDef.type === 'conjunction' || aspectDef.type === 'opposition') {
    if (LUMINARIES.has(p1) || LUMINARIES.has(p2)) {
      return 10;
    }
  }
  return aspectDef.baseOrb;
}

/**
 * Determine whether an aspect between two planets is applying.
 * Applying: the faster planet is moving toward exact aspect.
 * We approximate by checking if the angular gap is decreasing,
 * i.e. if planet1 is faster and the signed separation is positive
 * (planet1 is behind planet2 and closing), or vice-versa.
 */
function isApplying(
  lng1: number, speed1: number,
  lng2: number, speed2: number,
  aspectAngle: number,
): boolean {
  // Compute the current signed difference from planet1 to planet2
  // going in the ecliptic direction.
  const rawDiff = norm360(lng2 - lng1);

  // The nearest exact-aspect separation we need to reach:
  // Either rawDiff → aspectAngle, or rawDiff → 360 - aspectAngle
  const targetA = aspectAngle;
  const targetB = 360 - aspectAngle;

  const distA = norm360(rawDiff - targetA); // how far rawDiff is from targetA going forward
  const distB = norm360(rawDiff - targetB);

  // Pick which exact angle we're closer to
  const nearestTarget = distA <= distB ? targetA : targetB;

  // If rawDiff < nearestTarget (mod 360), planet2 is ahead; planet1 needs to
  // catch up.  That happens when planet1 is faster.
  const relativeSpeed = speed1 - speed2;
  const needToGainOnP2 = norm360(nearestTarget - rawDiff) < 180;

  return needToGainOnP2 ? relativeSpeed > 0 : relativeSpeed < 0;
}

function buildAspects(
  ephemeris: EphemerisResult,
): Aspect[] {
  const aspects: Aspect[] = [];

  // Build list of points: named planets + ascendant as pseudo-point
  type PointId = PlanetName | 'ascendant';
  interface Point {
    id: PointId;
    lng: number;
    speed: number;
  }

  const points: Point[] = ASPECT_PLANETS
    .filter(p => p in ephemeris.planets)
    .map(p => ({
      id: p as PointId,
      lng: ephemeris.planets[p]!.tropicalLng,
      speed: ephemeris.planets[p]!.speed,
    }));

  // Add ascendant as a fixed point (speed = 0)
  points.push({ id: 'ascendant', lng: ephemeris.ascendant, speed: 0 });

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const pt1 = points[i];
      const pt2 = points[j];
      const diff = angularDiff(pt1.lng, pt2.lng);

      for (const def of ASPECT_DEFS) {
        const orb = getOrb(
          def,
          pt1.id as PlanetName,
          pt2.id as PlanetName,
        );
        const actualOrb = Math.abs(diff - def.angle);
        if (actualOrb <= orb) {
          const applying = isApplying(
            pt1.lng, pt1.speed,
            pt2.lng, pt2.speed,
            def.angle,
          );
          aspects.push({
            planet1:  pt1.id as PlanetName,
            planet2:  pt2.id as PlanetName,
            type:     def.type,
            orb:      Math.round(actualOrb * 100) / 100,
            applying,
          });
        }
      }
    }
  }

  return aspects;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildWesternChart(
  ephemeris: EphemerisResult,
  houseSystem: 'placidus' | 'whole-sign' = 'whole-sign',
): WesternChart {
  // 1. House cusps
  const cusps: number[] =
    houseSystem === 'placidus'
      ? placidusHybridCusps(ephemeris.ascendant, ephemeris.midheaven)
      : wholeSignCusps(ephemeris.ascendant);

  // 2. Planet data
  const planets: Partial<Record<PlanetName, WesternPlanetData>> = {};

  for (const [rawName, position] of Object.entries(ephemeris.planets) as [PlanetName, typeof ephemeris.planets[PlanetName]][]) {
    if (!position) continue;

    const { tropicalLng, retrograde } = position;
    const sIdx   = signIndex(tropicalLng);
    const sign   = SIGNS[sIdx];
    const degree = degreeInSign(tropicalLng);
    const house  = housePlacement(tropicalLng, cusps);
    const dignity = getPlanetDignity(rawName, tropicalLng);

    planets[rawName] = {
      planet:    rawName,
      sign,
      degree:    Math.round(degree * 1000) / 1000,
      retrograde,
      house,
      dignity,
    };
  }

  // 3. Aspects
  const aspects = buildAspects(ephemeris);

  return {
    planets,
    houses: cusps,
    houseSystem,
    aspects,
  };
}
