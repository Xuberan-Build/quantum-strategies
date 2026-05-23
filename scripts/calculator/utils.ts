import type { ZodiacSign } from './types';

/** Normalize any angle to [0, 360). */
export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export const SIGNS: readonly ZodiacSign[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
