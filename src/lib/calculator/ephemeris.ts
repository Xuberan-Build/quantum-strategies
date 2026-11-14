import * as Astronomy from 'astronomy-engine';
import type { BirthData, EphemerisResult, PlanetName, PlanetPosition } from './types';
import { norm360 } from './utils';

// ---------------------------------------------------------------------------
// Utility helpers (ephemeris-local)
// ---------------------------------------------------------------------------

/** Normalize angle difference to [-180, +180] for speed/retrograde detection. */
function normDiff(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
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
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + D + B - 1524.5;
}

function julianCentury(date: Date): number {
  return (toJD(date) - 2451545.0) / 36525;
}

// ---------------------------------------------------------------------------
// Timezone → UTC conversion
// ---------------------------------------------------------------------------

/**
 * Converts local birth datetime + IANA timezone to a UTC Date.
 *
 * Uses Intl.DateTimeFormat to measure the UTC↔local offset at the candidate
 * instant, then corrects. If the resulting UTC time doesn't round-trip (e.g.
 * birth falls in a DST gap — a non-existent local time), the closest valid
 * UTC instant is returned and a warning is logged.
 */
export function birthDataToUtc(data: BirthData): Date {
  const { birthDate, birthTime, timezone } = data;
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  function localParts(utcMs: number) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
    return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), m: get('minute') };
  }

  const atNaive = localParts(naiveUtc);
  const offsetMs = Date.UTC(atNaive.y, atNaive.mo - 1, atNaive.d, atNaive.h, atNaive.m) - naiveUtc;
  const corrected = naiveUtc - offsetMs;

  // Verify the round-trip: if it fails, the birth time fell in a DST gap.
  const check = localParts(corrected);
  if (check.h !== hour || check.m !== minute) {
    // DST spring-forward gap: the stated local time doesn't exist.
    // Try the post-gap instant (1 hour later) and use whichever is closer.
    const postGap = corrected + 3_600_000;
    const checkPostGap = localParts(postGap);
    if (checkPostGap.h === hour && checkPostGap.m === minute) {
      return new Date(postGap);
    }
    console.warn(
      `[ephemeris] birthDataToUtc: ${birthDate} ${birthTime} ${timezone} falls in a DST gap. ` +
      `Using best-estimate UTC.`
    );
  }

  return new Date(corrected);
}

// ---------------------------------------------------------------------------
// Sun longitude
// ---------------------------------------------------------------------------

export function getSunLongitude(date: Date): number {
  return norm360(Astronomy.SunPosition(date).elon);
}

// ---------------------------------------------------------------------------
// True Lunar Node
// ---------------------------------------------------------------------------

/**
 * True (osculating) lunar node: where the plane of the Moon's instantaneous geocentric
 * orbit crosses the ecliptic of date, northbound. Computed from the Moon's position and
 * velocity (angular momentum h = r × v; ascending node direction = ẑ × h), which is how
 * Swiss Ephemeris and the reference Human Design calculators define the "true node".
 *
 * Until 2026-11-14 this used a short Meeus-style series with the wrong arguments
 * (2(F−Ω) for 2(D−F), etc.). The nodes then disagreed with published charts in 25 of 18×2
 * activations (scripts/calculator/reference-check.ts).
 */
function getTrueNorthNode(date: Date): number {
  const time = Astronomy.MakeTime(date);
  const eqj = Astronomy.GeoMoonState(time);
  const s = Astronomy.RotateState(Astronomy.Rotation_EQJ_ECT(time), eqj);
  const hx = s.y * s.vz - s.z * s.vy;
  const hy = s.z * s.vx - s.x * s.vz;
  // Ascending node vector n = ẑ × h = (−hy, hx, 0)
  return norm360(Math.atan2(hx, -hy) * (180 / Math.PI));
}

// ---------------------------------------------------------------------------
// Chiron via JPL Horizons (with in-process cache)
// ---------------------------------------------------------------------------

/** Key: 'YYYY-Mon-DD' → cached result (null = fetch failed). */
const chironCache = new Map<string, PlanetPosition | null>();

function jplDateKey(date: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getUTCFullYear()}-${months[date.getUTCMonth()]}-${String(date.getUTCDate()).padStart(2,'0')}`;
}

/**
 * Fetches Chiron's ecliptic longitude from JPL Horizons.
 * Returns null on network/parse failure (caller decides how to handle it).
 * Results are cached in-process by date, so repeated calls for the same day
 * (e.g. natal vs design on the same date) cost only one request.
 */
async function fetchChironLongitude(date: Date): Promise<PlanetPosition | null> {
  const key = jplDateKey(date);
  if (chironCache.has(key)) return chironCache.get(key)!;

  const start = key;
  const stop  = jplDateKey(new Date(date.getTime() + 86_400_000));

  const url =
    `https://ssd.jpl.nasa.gov/api/horizons.api?format=text` +
    `&COMMAND='Chiron'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'` +
    `&CENTER='500@399'` +
    `&START_TIME='${encodeURIComponent(start)}'` +
    `&STOP_TIME='${encodeURIComponent(stop)}'` +
    `&STEP_SIZE='1d'&QUANTITIES='31'`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();

    const soeIdx = text.indexOf('$$SOE');
    const eoeIdx = text.indexOf('$$EOE');
    if (soeIdx === -1 || eoeIdx === -1) throw new Error('Missing $$SOE/$$EOE markers');

    const lines = text
      .slice(soeIdx + 5, eoeIdx)
      .trim()
      .split('\n')
      .filter(l => l.trim().length > 0);

    if (lines.length === 0) throw new Error('Empty data block');

    const parts0 = lines[0].trim().split(/\s+/);
    const lng0   = parseFloat(parts0[2]);
    if (isNaN(lng0)) throw new Error(`Cannot parse longitude: "${lines[0]}"`);

    let speed = 0;
    if (lines.length >= 2) {
      const parts1 = lines[1].trim().split(/\s+/);
      const lng1   = parseFloat(parts1[2]);
      if (!isNaN(lng1)) speed = normDiff(lng1 - lng0);
    }

    const result: PlanetPosition = { tropicalLng: norm360(lng0), speed, retrograde: speed < 0 };
    chironCache.set(key, result);
    return result;
  } catch (err) {
    console.warn(`[ephemeris] Chiron unavailable (${(err as Error).message}) — omitting from chart.`);
    chironCache.set(key, null);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ascendant & Midheaven
// ---------------------------------------------------------------------------

function obliquity(date: Date): number {
  const T = julianCentury(date);
  return 23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
}

/**
 * Compute Midheaven (MC) and Ascendant (ASC) ecliptic longitudes.
 *
 * RAMC = (Greenwich Sidereal Time + observer longitude in hours) × 15°
 * MC : tan(MC)  = tan(RAMC) / cos(ε)
 * ASC: tan(ASC) = cos(RAMC) / −(sin(ε)·tan(φ) + cos(ε)·sin(RAMC))
 *
 * The sign of cos(RAMC) in the ASC numerator encodes the correct ecliptic
 * hemisphere directly via atan2 — no additional quadrant correction needed.
 */
function computeAngles(date: Date, lat: number, lng: number): { asc: number; mc: number } {
  const gst    = Astronomy.SiderealTime(date);           // hours
  const ramc   = norm360((gst + lng / 15) * 15);         // degrees
  const eps    = obliquity(date);
  const eps_r  = eps  * (Math.PI / 180);
  const ramc_r = ramc * (Math.PI / 180);
  const lat_r  = lat  * (Math.PI / 180);

  // MC: place in same 180° semicircle as RAMC
  let mc = Math.atan2(Math.tan(ramc_r), Math.cos(eps_r)) * (180 / Math.PI);
  if (ramc < 180) {
    if (mc < 0)    mc += 180;
    if (mc >= 180) mc -= 180;
  } else {
    if (mc >= 0 && mc < 180) mc += 180;
    if (mc < 0)               mc += 360;
  }
  mc = norm360(mc);

  // ASC: atan2 sign of cos(RAMC) encodes the correct hemisphere
  const asc = norm360(
    Math.atan2(
      Math.cos(ramc_r),
      -(Math.sin(eps_r) * Math.tan(lat_r) + Math.cos(eps_r) * Math.sin(ramc_r))
    ) * (180 / Math.PI)
  );

  return { asc, mc };
}

// ---------------------------------------------------------------------------
// Planet position helpers
// ---------------------------------------------------------------------------

function geocentricEclipticLng(body: Astronomy.Body, date: Date): number {
  return norm360(Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon);
}

function planetSpeed(body: Astronomy.Body, date: Date): { lng: number; speed: number } {
  const lng0 = geocentricEclipticLng(body, date);
  const lng1 = geocentricEclipticLng(body, new Date(date.getTime() + 86_400_000));
  return { lng: lng0, speed: normDiff(lng1 - lng0) };
}

function moonLngSpeed(date: Date): { lng: number; speed: number } {
  const m0 = Astronomy.EclipticGeoMoon(date);
  const m1 = Astronomy.EclipticGeoMoon(new Date(date.getTime() + 86_400_000));
  return { lng: norm360(m0.lon), speed: normDiff(m1.lon - m0.lon) };
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

export async function getEphemeris(utcDatetime: Date, lat: number, lng: number): Promise<EphemerisResult> {
  // Sun
  const sunEc0 = Astronomy.SunPosition(utcDatetime);
  const sunEc1 = Astronomy.SunPosition(new Date(utcDatetime.getTime() + 86_400_000));
  const sunLng = norm360(sunEc0.elon);

  // Moon
  const { lng: moonLng, speed: moonSpeed } = moonLngSpeed(utcDatetime);

  // Outer planets
  const outerBodies: Array<[PlanetName, Astronomy.Body]> = [
    ['mercury', Astronomy.Body.Mercury],
    ['venus',   Astronomy.Body.Venus],
    ['mars',    Astronomy.Body.Mars],
    ['jupiter', Astronomy.Body.Jupiter],
    ['saturn',  Astronomy.Body.Saturn],
    ['uranus',  Astronomy.Body.Uranus],
    ['neptune', Astronomy.Body.Neptune],
    ['pluto',   Astronomy.Body.Pluto],
  ];

  const planets: Partial<Record<PlanetName, PlanetPosition>> = {};

  planets.sun  = { tropicalLng: sunLng, speed: normDiff(sunEc1.elon - sunEc0.elon), retrograde: false };
  planets.moon = { tropicalLng: moonLng, speed: moonSpeed, retrograde: moonSpeed < 0 };

  for (const [name, body] of outerBodies) {
    const { lng, speed } = planetSpeed(body, utcDatetime);
    planets[name] = { tropicalLng: lng, speed, retrograde: speed < 0 };
  }

  // Lunar nodes
  const nnLng  = getTrueNorthNode(utcDatetime);
  const nnLng1 = getTrueNorthNode(new Date(utcDatetime.getTime() + 86_400_000));
  const nnSpeed = normDiff(nnLng1 - nnLng);
  planets.northNode = { tropicalLng: nnLng,             speed: nnSpeed, retrograde: nnSpeed < 0 };
  planets.southNode = { tropicalLng: norm360(nnLng + 180), speed: nnSpeed, retrograde: nnSpeed < 0 };

  // Chiron — omit from planets if unavailable (JPL down or rate-limited)
  const chiron = await fetchChironLongitude(utcDatetime);
  if (chiron) planets.chiron = chiron;

  const { asc, mc } = computeAngles(utcDatetime, lat, lng);

  return {
    utcDatetime,
    lat,
    lng,
    planets: planets as Record<PlanetName, PlanetPosition>,
    ascendant: asc,
    midheaven: mc,
  };
}

/**
 * Human Design "design" moment: when the Sun stood 88° of solar arc before its birth
 * position (about 88 to 89 days earlier). A solar-arc rule, not a day count.
 * Until 2026-11-14 the engine used 88.736°, which put the design moment ~18 hours early
 * and shifted the Design Moon by ~10°. See brain/research/chart-industry/field-primer.md §2.5.
 */
export const DESIGN_SOLAR_ARC = 88;

export function findDesignDate(birthUtc: Date, birthSunLng: number, solarArc: number = DESIGN_SOLAR_ARC): Date {
  const targetLng = norm360(birthSunLng - solarArc);
  const searchStart = new Date(birthUtc.getTime() - 95 * 86_400_000);
  const result = Astronomy.SearchSunLongitude(targetLng, searchStart, 95);

  if (result === null) {
    console.warn('[ephemeris] SearchSunLongitude returned null — using linear estimate.');
    // Rough fallback: the Sun moves a little under 1° a day.
    return new Date(birthUtc.getTime() - solarArc * 1.0146 * 86_400_000);
  }

  return result.date;
}
