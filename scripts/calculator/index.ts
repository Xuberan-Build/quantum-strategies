import { BirthData, ChartResult } from './types';
import { birthDataToUtc, getEphemeris, getSunLongitude, findDesignDate } from './ephemeris';
import { buildWesternChart } from './western';
import { buildVedicChart } from './vedic';
import { buildHumanDesignChart } from './human-design';

export async function calculateChart(data: BirthData): Promise<ChartResult> {
  // Step 1: Convert local birth data to UTC
  const utcBirthDatetime = birthDataToUtc(data);

  // Step 2: Natal ephemeris (planets + houses at birth moment)
  const natalEphemeris = await getEphemeris(utcBirthDatetime, data.lat, data.lng);

  // Step 3: Birth Sun longitude (tropical) used to find the design date
  const birthSunLng = getSunLongitude(utcBirthDatetime);

  // Step 4: Design date = ~88 days before birth (Sun 88° earlier)
  const designDate = findDesignDate(utcBirthDatetime, birthSunLng);

  // Step 5: Design ephemeris (unconscious imprint)
  const designEphemeris = await getEphemeris(designDate, data.lat, data.lng);

  // Step 6-8: Build the three chart systems
  const western = buildWesternChart(natalEphemeris, 'whole-sign');
  const vedic = buildVedicChart(natalEphemeris, utcBirthDatetime);
  const humanDesign = buildHumanDesignChart(natalEphemeris, designEphemeris, designDate);

  return {
    birthData: data,
    utcBirthDatetime,
    western,
    vedic,
    humanDesign,
  };
}
