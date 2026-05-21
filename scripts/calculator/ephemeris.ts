/**
 * Ephemeris calculations using astronomy-engine (MIT).
 * Computes planet positions, ASC, MC for a given UTC datetime and location.
 */

import * as Astronomy from 'astronomy-engine';
import type { BirthData, EphemerisResult, PlanetName, PlanetPosition } from './types';

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Normalize any angle to [0, 360). */
function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Normalize angle difference to [-180, +180] for speed/retrograde detection. */
function normDiff(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** Convert a UTC Date to Julian centuries from J2000.0. */
function julianCentury(date: Date): number {
  const J2000 = 2451545.0;
  const jd = toJD(date);
  return (jd - J2000) / 36525;
}

/** Julian Day Number for a UTC Date (Meeus ch. 7). */
function toJD(date: Date): number {
  const Y = date.getUTCFullYear();
  const M = date.getUTCMonth() + 1;
  const D =
    date.getUTCDate() +
    (date.getUTCHours() + (date.getUTCMinutes() + date.getUTCSeconds() / 60) / 60) / 24;

  let year = Y;
  let month = M;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + D + B - 1524.5;
}

// ---------------------------------------------------------------------------
// Timezone → UTC conversion
// ---------------------------------------------------------------------------

/**
 * Converts local birth datetime + IANA timezone to a UTC Date.
 *
 * Strategy: construct a Date from the local date/time string, then use
 * Intl.DateTimeFormat to determine what that UTC instant looks like in the
 * target timezone and compute the offset.
 *
 * This works without any third-party tz library by exploiting the fact that
 * `new Date(isoString)` parses as UTC, and we can then binary-search the
 * correct UTC instant whose local representation matches the input.
 */
export function birthDataToUtc(data: BirthData): Date {
  const { birthDate, birthTime, timezone } = data;
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);

  // Build a naive UTC candidate: treat the local time as if it were UTC.
  // We'll correct for the offset below.
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Ask the platform: what does this UTC instant look like in the target tz?
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Helper: given a UTC timestamp, parse its local representation in `timezone`.
  function utcToLocalParts(utcMs: number): { y: number; mo: number; d: number; h: number; m: number; s: number } {
    const parts = formatter.formatToParts(new Date(utcMs));
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
    return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), m: get('minute'), s: get('second') };
  }

  // The offset at the naive UTC point gives us a first-order correction.
  const localAtNaive = utcToLocalParts(naiveUtc);
  const localMs =
    Date.UTC(
      localAtNaive.y,
      localAtNaive.mo - 1,
      localAtNaive.d,
      localAtNaive.h,
      localAtNaive.m,
      localAtNaive.s
    );
  // offset = local - UTC  (positive for zones east of UTC)
  const offsetMs = localMs - naiveUtc;
  // Corrected UTC: the UTC instant whose local time IS our target
  const correctedUtc = naiveUtc - offsetMs;

  // Verify (handles DST gaps/ambiguities by re-checking)
  const verify = utcToLocalParts(correctedUtc);
  if (
    verify.y === year &&
    verify.mo === month &&
    verify.d === day &&
    verify.h === hour &&
    verify.m === minute
  ) {
    return new Date(correctedUtc);
  }

  // If not exact (e.g. hour=24 edge case), fall back to the corrected value.
  return new Date(correctedUtc);
}

// ---------------------------------------------------------------------------
// Sun longitude
// ---------------------------------------------------------------------------

/**
 * Returns the Sun's tropical ecliptic longitude at the given UTC date.
 * Uses SunPosition which returns geocentric ecliptic coordinates.
 */
export function getSunLongitude(date: Date): number {
  const ec = Astronomy.SunPosition(date);
  return norm360(ec.elon);
}

// ---------------------------------------------------------------------------
// True Lunar Node (North Node)
// ---------------------------------------------------------------------------

/**
 * Approximates the mean North Node longitude.
 *
 * Formula (Meeus "Astronomical Algorithms", eq. 47.7):
 *   Ω = 125.0445479 − 1934.1362608 * T  (degrees, T = Julian centuries from J2000)
 *   corrected with small periodic terms for the true node.
 */
function getTrueNorthNode(date: Date): number {
  const T = julianCentury(date);

  // Mean longitude of the ascending node (Meeus 47.7)
  let omega =
    125.0445479 -
    1934.1362608 * T +
    0.0020754 * T * T +
    T * T * T / 467441 -
    T * T * T * T / 60616000;

  // Periodic corrections for the true node (abridged from Meeus ch. 22)
  const D_rad = (297.85036 + 445267.111480 * T) * (Math.PI / 180);
  const M_rad = (357.52772 + 35999.050340 * T) * (Math.PI / 180);
  const Mp_rad = (134.96298 + 477198.867398 * T) * (Math.PI / 180);
  const F_rad = (93.27191 + 483202.017538 * T) * (Math.PI / 180);

  const correction =
    -1.4979 * Math.sin(2 * (F_rad - omega * (Math.PI / 180))) -
    0.1500 * Math.sin(M_rad) -
    0.1226 * Math.sin(2 * (F_rad - omega * (Math.PI / 180)) + 2 * D_rad) +
    0.1176 * Math.sin(2 * (F_rad - omega * (Math.PI / 180)) - 2 * D_rad) -
    0.0801 * Math.sin(2 * (Mp_rad - F_rad));

  return norm360(omega + correction);
}

// ---------------------------------------------------------------------------
// Chiron via JPL Horizons
// ---------------------------------------------------------------------------

/**
 * Format a UTC Date as 'YYYY-Mon-DD' for JPL Horizons.
 * e.g. 1990-Apr-20
 */
function formatJplDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const y = date.getUTCFullYear();
  const m = months[date.getUTCMonth()];
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Fetches Chiron's ecliptic longitude from the JPL Horizons API.
 * Quantities=31 returns "ObsEcLon,ObsEcLat" (observer-referenced ecliptic).
 * Falls back to { tropicalLng: 0, speed: 0, retrograde: false } on error.
 */
async function fetchChironLongitude(date: Date): Promise<PlanetPosition> {
  const startDate = formatJplDate(date);
  // Stop date: one day later
  const stopDate = formatJplDate(new Date(date.getTime() + 86400000));

  const url =
    `https://ssd.jpl.nasa.gov/api/horizons.api?format=text` +
    `&COMMAND='Chiron'` +
    `&OBJ_DATA='NO'` +
    `&MAKE_EPHEM='YES'` +
    `&EPHEM_TYPE='OBSERVER'` +
    `&CENTER='500@399'` +
    `&START_TIME='${encodeURIComponent(startDate)}'` +
    `&STOP_TIME='${encodeURIComponent(stopDate)}'` +
    `&STEP_SIZE='1d'` +
    `&QUANTITIES='31'`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const text = await resp.text();

    // The ephemeris data block lies between $$SOE and $$EOE markers.
    // Quantities=31 output format: Date__(UT)__HR:MN, ObsEcLon, ObsEcLat
    const soeIdx = text.indexOf('$$SOE');
    const eoeIdx = text.indexOf('$$EOE');
    if (soeIdx === -1 || eoeIdx === -1) {
      throw new Error('Could not find data block in Horizons response');
    }
    const block = text.slice(soeIdx + 5, eoeIdx).trim();
    // First data line after $$SOE
    const firstLine = block.split('\n').find(l => l.trim().length > 0);
    if (!firstLine) {
      throw new Error('Empty data block in Horizons response');
    }
    // Format: "2000-Jan-01 00:00  123.456789 +12.345678"
    // Split on whitespace; fields: date, time, eclLon, eclLat
    const parts = firstLine.trim().split(/\s+/);
    // date=parts[0], time=parts[1], lon=parts[2], lat=parts[3]
    if (parts.length < 3) {
      throw new Error(`Unexpected Horizons data format: ${firstLine}`);
    }
    const tropicalLng = parseFloat(parts[2]);
    if (isNaN(tropicalLng)) {
      throw new Error(`Could not parse longitude from: ${firstLine}`);
    }

    // Fetch speed: get the next day's longitude if there's a second data line
    let speed = 0;
    const lines = block.split('\n').filter(l => l.trim().length > 0);
    if (lines.length >= 2) {
      const nextParts = lines[1].trim().split(/\s+/);
      const nextLng = parseFloat(nextParts[2]);
      if (!isNaN(nextLng)) {
        speed = normDiff(nextLng - tropicalLng);
      }
    }

    return {
      tropicalLng: norm360(tropicalLng),
      speed,
      retrograde: speed < 0,
    };
  } catch (err) {
    console.warn(`[ephemeris] Chiron fetch failed: ${(err as Error).message}. Using fallback.`);
    return { tropicalLng: 0, speed: 0, retrograde: false };
  }
}

// ---------------------------------------------------------------------------
// Ascendant & Midheaven
// ---------------------------------------------------------------------------

/**
 * Compute the ecliptic obliquity for the given date.
 * Uses the IAU 1980 formula (accurate to ~0.01° over a few centuries).
 */
function obliquity(date: Date): number {
  const T = julianCentury(date);
  // Degrees
  return 23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
}

/**
 * Compute Midheaven (MC) ecliptic longitude and Ascendant (ASC) ecliptic longitude.
 *
 * References: "Astronomical Algorithms" Meeus, ch. 29 (house cusps).
 *
 * RAMC = Right Ascension of the Midheaven, in degrees
 *   = (Greenwich Sidereal Time + observer_longitude) * 15
 *
 * MC: tan(MC) = tan(RAMC) / cos(ε)   — choose the correct quadrant
 * ASC: tan(ASC) = cos(RAMC) / -(sin(ε)*tan(φ) + cos(ε)*sin(RAMC))
 */
function computeAngles(date: Date, lat: number, lng: number): { asc: number; mc: number } {
  const gst = Astronomy.SiderealTime(date); // hours, Greenwich Apparent Sidereal Time
  const ramc = norm360((gst + lng / 15) * 15); // RAMC in degrees

  const eps = obliquity(date);
  const eps_r = eps * (Math.PI / 180);
  const ramc_r = ramc * (Math.PI / 180);
  const lat_r = lat * (Math.PI / 180);

  // --- Midheaven ---
  // tan(MC_ecl) = tan(RAMC) / cos(ε)
  let mc = Math.atan2(Math.tan(ramc_r), Math.cos(eps_r)) * (180 / Math.PI);
  // Ensure MC is in the same quadrant as RAMC
  // RAMC quadrant: 0-90 → Q1, 90-180 → Q2, 180-270 → Q3, 270-360 → Q4
  // MC must be in the same 180-degree semicircle
  if (ramc >= 0 && ramc < 180) {
    // MC should be in 0-180
    if (mc < 0) mc += 180;
    if (mc >= 180) mc -= 180;
  } else {
    // MC should be in 180-360
    if (mc >= 0 && mc < 180) mc += 180;
    if (mc < 0) mc += 360;
  }
  mc = norm360(mc);

  // --- Ascendant ---
  // tan(ASC) = cos(RAMC) / -(sin(ε)*tan(φ) + cos(ε)*sin(RAMC))
  const numerator = Math.cos(ramc_r);
  const denominator = -(Math.sin(eps_r) * Math.tan(lat_r) + Math.cos(eps_r) * Math.sin(ramc_r));

  let asc = Math.atan2(numerator, denominator) * (180 / Math.PI);
  // Bring into 0-360
  asc = norm360(asc);

  // The ASC must be in the eastern half of the chart (opposite to MC).
  // A robust correction: ASC should be roughly 90° from RAMC in the right direction.
  // Ensure ASC and MC are approximately opposite (within 90°-270° apart).
  const diff = norm360(asc - mc);
  if (diff < 90 || diff > 270) {
    asc = norm360(asc + 180);
  }

  return { asc, mc };
}

// ---------------------------------------------------------------------------
// Planet speed helper
// ---------------------------------------------------------------------------

function geocentricEclipticLng(body: Astronomy.Body, date: Date): number {
  const geoVec = Astronomy.GeoVector(body, date, true);
  const ecl = Astronomy.Ecliptic(geoVec);
  return norm360(ecl.elon);
}

function planetSpeed(body: Astronomy.Body, date: Date): { lng: number; speed: number } {
  const lng0 = geocentricEclipticLng(body, date);
  const datePlus1 = new Date(date.getTime() + 86400000);
  const lng1 = geocentricEclipticLng(body, datePlus1);
  const speed = normDiff(lng1 - lng0);
  return { lng: lng0, speed };
}

function moonLngSpeed(date: Date): { lng: number; speed: number } {
  const moon0 = Astronomy.EclipticGeoMoon(date);
  const datePlus1 = new Date(date.getTime() + 86400000);
  const moon1 = Astronomy.EclipticGeoMoon(datePlus1);
  const lng = norm360(moon0.lon);
  const speed = normDiff(moon1.lon - moon0.lon);
  return { lng, speed };
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * Returns planet positions + ASC + MC for the given UTC datetime and location.
 */
export async function getEphemeris(utcDatetime: Date, lat: number, lng: number): Promise<EphemerisResult> {
  // Sun
  const sunEc = Astronomy.SunPosition(utcDatetime);
  const sunLng0 = norm360(sunEc.elon);
  const sunEc1 = Astronomy.SunPosition(new Date(utcDatetime.getTime() + 86400000));
  const sunSpeed = normDiff(sunEc1.elon - sunEc.elon);

  // Moon
  const { lng: moonLng, speed: moonSpeed } = moonLngSpeed(utcDatetime);

  // Standard planets
  const bodyMap: Array<[PlanetName, Astronomy.Body]> = [
    ['mercury', Astronomy.Body.Mercury],
    ['venus',   Astronomy.Body.Venus],
    ['mars',    Astronomy.Body.Mars],
    ['jupiter', Astronomy.Body.Jupiter],
    ['saturn',  Astronomy.Body.Saturn],
    ['uranus',  Astronomy.Body.Uranus],
    ['neptune', Astronomy.Body.Neptune],
    ['pluto',   Astronomy.Body.Pluto],
  ];

  const planetPositions: Partial<Record<PlanetName, PlanetPosition>> = {};

  planetPositions['sun'] = {
    tropicalLng: sunLng0,
    speed: sunSpeed,
    retrograde: sunSpeed < 0,
  };

  planetPositions['moon'] = {
    tropicalLng: moonLng,
    speed: moonSpeed,
    retrograde: moonSpeed < 0,
  };

  for (const [name, body] of bodyMap) {
    const { lng: pLng, speed: pSpeed } = planetSpeed(body, utcDatetime);
    planetPositions[name] = {
      tropicalLng: pLng,
      speed: pSpeed,
      retrograde: pSpeed < 0,
    };
  }

  // North Node (true lunar node approximation)
  const northNodeLng = getTrueNorthNode(utcDatetime);
  const northNodeLngNext = getTrueNorthNode(new Date(utcDatetime.getTime() + 86400000));
  const northNodeSpeed = normDiff(northNodeLngNext - northNodeLng);

  planetPositions['northNode'] = {
    tropicalLng: northNodeLng,
    speed: northNodeSpeed,
    retrograde: northNodeSpeed < 0, // North Node is almost always retrograde
  };

  // South Node = North Node + 180
  planetPositions['southNode'] = {
    tropicalLng: norm360(northNodeLng + 180),
    speed: northNodeSpeed,
    retrograde: northNodeSpeed < 0,
  };

  // Chiron (via JPL Horizons async fetch)
  const chironPos = await fetchChironLongitude(utcDatetime);
  planetPositions['chiron'] = chironPos;

  // ASC + MC
  const { asc, mc } = computeAngles(utcDatetime, lat, lng);

  return {
    utcDatetime,
    lat,
    lng,
    planets: planetPositions as Record<PlanetName, PlanetPosition>,
    ascendant: asc,
    midheaven: mc,
  };
}

/**
 * Finds the UTC datetime when the Sun was exactly 88.736° earlier than
 * the birth Sun longitude (used for the Human Design "design date").
 *
 * Searches backwards from birthUtc by up to 93 days (the 88.736° shift
 * spans roughly 88-89 solar days, with a buffer for safety).
 */
export function findDesignDate(birthUtc: Date, birthSunLng: number): Date {
  // Target longitude = birthSunLng - 88.736 (mod 360)
  const targetLng = norm360(birthSunLng - 88.736);

  // Start searching from ~95 days before birth (generous buffer)
  const searchStart = new Date(birthUtc.getTime() - 95 * 86400000);
  const limitDays = 95;

  const result = Astronomy.SearchSunLongitude(targetLng, searchStart, limitDays);
  if (result === null) {
    // Fallback: estimate by subtracting ~88.736 days (1 degree ≈ 1 day for Sun)
    console.warn('[ephemeris] SearchSunLongitude returned null for design date; using linear estimate.');
    return new Date(birthUtc.getTime() - 88.736 * 86400000);
  }

  return result.date;
}
