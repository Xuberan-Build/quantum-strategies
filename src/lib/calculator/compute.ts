import { unstable_cache } from 'next/cache';
import crypto from 'crypto';
import type { ChartResult } from './types';
import { birthDataToUtc, getEphemeris, findDesignDate } from './ephemeris';
import { buildWesternChart } from './western';
import { buildVedicChart } from './vedic';
import { buildHumanDesignChart } from './human-design';

export interface StoredBirthData {
  date: string;      // "YYYY-MM-DD"
  time: string;      // "HH:MM"
  city: string;
  lat: number;
  lng: number;
  timezone: string;  // IANA
  timeUnknown?: boolean;
}

function birthDataFingerprint(stored: StoredBirthData): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stored))
    .digest('hex')
    .slice(0, 16);
}

export function getCachedChart(userId: string, stored: StoredBirthData): Promise<ChartResult> {
  const fingerprint = birthDataFingerprint(stored);
  return unstable_cache(
    () => computeChart(stored),
    [`chart-${userId}-${fingerprint}`],
    {
      revalidate: 3600,
      tags: [`chart-user-${userId}`],
    }
  )();
}

export async function computeChart(stored: StoredBirthData): Promise<ChartResult> {
  const bd = {
    birthDate: stored.date,
    birthTime: stored.time,
    timezone: stored.timezone,
    lat: stored.lat,
    lng: stored.lng,
  };
  const utc = birthDataToUtc(bd);
  const [natalEph] = await Promise.all([getEphemeris(utc, stored.lat, stored.lng)]);
  const birthSunLng = natalEph.planets.sun.tropicalLng;
  const designDate = findDesignDate(utc, birthSunLng);
  const designEph = await getEphemeris(designDate, stored.lat, stored.lng);

  return {
    birthData: bd,
    utcBirthDatetime: utc,
    western: buildWesternChart(natalEph),
    vedic: buildVedicChart(natalEph, utc),
    humanDesign: buildHumanDesignChart(natalEph, designEph, designDate),
  };
}
