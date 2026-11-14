import { describe, it, expect } from 'vitest';
import { gateFromLongitude, GATE_START_DEGREE, GATE_SEQUENCE } from '../human-design';
import { findDesignDate, getSunLongitude, DESIGN_SOLAR_ARC } from '../ephemeris';

describe('Human Design wheel (field convention)', () => {
  it('starts Gate 41 at 2°00′ Aquarius (302°)', () => {
    expect(GATE_START_DEGREE).toBe(302);
    expect(gateFromLongitude(302.0)).toEqual({ gate: 41, line: 1 });
    expect(gateFromLongitude(302.0 + 5 * 0.9375 + 0.01)).toEqual({ gate: 41, line: 6 });
  });

  it('puts the degree just before 302° in the last gate of the wheel (60.6)', () => {
    expect(gateFromLongitude(301.99)).toEqual({ gate: GATE_SEQUENCE[63], line: 6 });
    expect(GATE_SEQUENCE[63]).toBe(60);
  });

  it('steps one gate every 5.625°', () => {
    expect(gateFromLongitude(307.625).gate).toBe(19);
    expect(gateFromLongitude(313.25).gate).toBe(13);
    // Gate 25 begins at 28°15′ Pisces (358.25°), per published gate tables.
    expect(gateFromLongitude(358.25)).toEqual({ gate: 25, line: 1 });
  });

  it('wraps through 0° Aries', () => {
    expect(gateFromLongitude(0.5).gate).toBe(gateFromLongitude(360.5).gate);
  });

  it('accepts an explicit start for comparisons only', () => {
    expect(gateFromLongitude(301.8, 301.625)).toEqual({ gate: 41, line: 1 });
    expect(gateFromLongitude(301.8).gate).toBe(60);
  });
});

describe('Design moment', () => {
  it('is where the Sun stood exactly 88° of solar arc before birth', () => {
    expect(DESIGN_SOLAR_ARC).toBe(88);
    const birth = new Date('1990-06-15T12:00:00Z');
    const birthSun = getSunLongitude(birth);
    const design = findDesignDate(birth, birthSun);
    const designSun = getSunLongitude(design);
    const arc = ((birthSun - designSun) % 360 + 360) % 360;
    expect(arc).toBeCloseTo(88, 3);
    const days = (birth.getTime() - design.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(87);
    expect(days).toBeLessThan(93);
  });
});
