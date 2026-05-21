/**
 * Lahiri (Chitrapaksha) ayanamsa calculation.
 *
 * Reference epoch: J1900.0 = January 0.5, 1900 UT (= 1899-Dec-31 12:00 UT)
 * Ayanamsa at J1900.0: 22° 27' 37.76" = 22.46049° (Lahiri official value)
 * Annual precession rate: 50.2388475" / year = 0.013955235° / year
 *
 * The formula below matches the Lahiri ayanamsa published by the
 * Indian Astronomical Ephemeris (widely used in Vedic astrology software).
 */

const J1900_JD = 2415020.0;           // Julian Day for J1900.0
const J2000_JD = 2451545.0;           // Julian Day for J2000.0
const AYANAMSA_AT_J1900 = 22.46049;   // degrees at J1900.0
const ANNUAL_PRECESSION_DEG = 50.2388475 / 3600; // degrees per year

/**
 * Returns the Julian Day Number for a given UTC Date.
 */
function toJulianDay(date: Date): number {
  // Algorithm from Jean Meeus "Astronomical Algorithms" ch.7
  const Y = date.getUTCFullYear();
  const M = date.getUTCMonth() + 1; // 1-12
  const D =
    date.getUTCDate() +
    (date.getUTCHours() +
      (date.getUTCMinutes() + date.getUTCSeconds() / 60) / 60) /
      24;

  let year = Y;
  let month = M;
  if (M <= 2) {
    year -= 1;
    month += 12;
  }

  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + D + B - 1524.5;
}

/**
 * Returns Lahiri ayanamsa in decimal degrees for the given UTC date.
 *
 * Formula: ayanamsa = AYANAMSA_AT_J1900 + (JD - J1900_JD) / 365.25 * ANNUAL_PRECESSION_DEG
 */
export function getLahiriAyanamsa(date: Date): number {
  const jd = toJulianDay(date);
  const yearsSinceJ1900 = (jd - J1900_JD) / 365.25;
  const ayanamsa = AYANAMSA_AT_J1900 + yearsSinceJ1900 * ANNUAL_PRECESSION_DEG;
  return ayanamsa;
}

/**
 * Converts a tropical ecliptic longitude to sidereal (Lahiri) longitude.
 *
 * @param tropicalLng  Tropical longitude in degrees [0, 360)
 * @param ayanamsa     Lahiri ayanamsa in degrees (from getLahiriAyanamsa)
 * @returns            Sidereal longitude in degrees [0, 360)
 */
export function tropicalToSidereal(tropicalLng: number, ayanamsa: number): number {
  return ((tropicalLng - ayanamsa) % 360 + 360) % 360;
}
