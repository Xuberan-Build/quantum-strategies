import type { ChartResult } from './types';
import type { Placements } from '@/lib/utils/placements';

export function chartResultToPlacements(result: ChartResult): Placements {
  const w = result.western;
  const hd = result.humanDesign;

  function planetSign(name: keyof typeof w.planets): string {
    const p = w.planets[name];
    return p ? `${p.sign} ${p.degree.toFixed(1)}°` : 'UNKNOWN';
  }

  const signs = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
  ];
  const house1Cusp = w.houses[0];
  const risingIdx = Math.floor(((house1Cusp % 360) + 360) % 360 / 30);
  const rising = signs[risingIdx] ?? 'UNKNOWN';

  return {
    astrology: {
      sun:     planetSign('sun'),
      moon:    planetSign('moon'),
      rising,
      mercury: planetSign('mercury'),
      venus:   planetSign('venus'),
      mars:    planetSign('mars'),
      jupiter: planetSign('jupiter'),
      saturn:  planetSign('saturn'),
      uranus:  planetSign('uranus'),
      neptune: planetSign('neptune'),
      pluto:   planetSign('pluto'),
    },
    human_design: {
      type:       hd.type,
      profile:    hd.profile,
      authority:  hd.authority,
      definition: hd.definition,
      channels:   hd.definedChannels.join(', '),
    },
  };
}
