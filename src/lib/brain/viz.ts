/**
 * Client-safe presentation helpers for /admin/brain: palette roles, labels,
 * number formatting and scales. Contains no brain content.
 *
 * Palette (validated with the dataviz six-checks script against the dark brain
 * surface #16120e, adjacent pairs in schema order):
 *   pillars  categorical  bronze · verdigris · amethyst · ochre · garnet
 *            worst adjacent CVD ΔE 9.2, normal-vision ΔE 17.5, all >= 3:1
 *   rites    ordinal      one bronze hue, monotone L, light end 3.18:1
 */
import type { BrainSnapshot, PillarSlug, Rite } from './snapshot';

export const PILLAR_ORDER: readonly PillarSlug[] = [
  'architecture-of-self',
  'value-as-waveform',
  'direction-over-outcome',
  'state-engineering',
  'anchored-ascended',
];

export const RITE_ORDER: readonly Rite[] = ['perception', 'orientation', 'declaration'];

export const PILLAR_COLOR: Record<PillarSlug, string> = {
  'architecture-of-self': '#c07a3e',
  'value-as-waveform': '#3fa58e',
  'direction-over-outcome': '#9179e8',
  'state-engineering': '#a8861a',
  'anchored-ascended': '#d0607a',
};

/** Ordinal ramp: deeper into the funnel reads brighter. */
export const RITE_COLOR: Record<Rite, string> = {
  perception: '#8a5a30',
  orientation: '#b97d45',
  declaration: '#e6b27a',
};

export const RITE_NUMERAL: Record<Rite, string> = {
  perception: 'I',
  orientation: 'II',
  declaration: 'III',
};

/** Fallback labels derived from the public slugs, used when the snapshot omits a title. */
export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function pillarTitles(snapshot: Pick<BrainSnapshot, 'taxonomy'> | null): Record<PillarSlug, string> {
  const out = {} as Record<PillarSlug, string>;
  for (const slug of PILLAR_ORDER) {
    const found = snapshot?.taxonomy.pillars.find((p) => p.slug === slug);
    out[slug] = found?.title ?? (slug === 'anchored-ascended' ? 'Anchored → Ascended' : titleFromSlug(slug));
  }
  return out;
}

export function riteTitle(rite: Rite): string {
  return titleFromSlug(rite);
}

/** Sequential heat ramp on the dark surface: near-surface (low) to bright bronze (high). */
export const HEAT_RAMP = ['#3a2a1c', '#5c3f24', '#87592f', '#b47a3f', '#e0a96c'] as const;

export function heatColor(value: number, max: number): string | null {
  if (value <= 0 || max <= 0) return null;
  if (max === 1) return HEAT_RAMP[HEAT_RAMP.length - 1];
  const idx = Math.round((Math.min(value, max) - 1) / (max - 1) * (HEAT_RAMP.length - 1));
  return HEAT_RAMP[idx];
}

/** Ink for text set inside a filled cell, chosen by the fill's luminance. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return lum > 0.22 ? '#16120e' : '#efe6d6';
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en');

export function formatCompact(value: number): string {
  return Math.abs(value) >= 1000 ? compact.format(value) : plain.format(Math.round(value * 100) / 100);
}

export function formatValue(value: number | string): string {
  return typeof value === 'number' ? formatCompact(value) : value;
}

export function formatMultiple(value: number): string {
  if (value <= 0) return '0×';
  if (value < 0.1) return `${value.toFixed(2)}×`;
  if (value < 10) return `${value.toFixed(1)}×`;
  return `${Math.round(value)}×`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export function relativeAge(iso: string, now: number = Date.now()): { label: string; days: number } {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { label: 'unknown age', days: Infinity };
  const minutes = Math.max(0, Math.round((now - t) / 60000));
  const days = minutes / 1440;
  if (minutes < 1) return { label: 'just now', days };
  if (minutes < 60) return { label: `${minutes} min ago`, days };
  const hours = Math.round(minutes / 60);
  if (hours < 48) return { label: `${hours} h ago`, days };
  return { label: `${Math.round(days)} days ago`, days };
}

/** Log10 scale mapping [min, max] onto [0, width]. Values at or below min clamp to 0. */
export function logScale(min: number, max: number, width: number) {
  const lo = Math.log10(min);
  const hi = Math.log10(max);
  return (value: number) => {
    const v = Math.log10(Math.max(min, Math.min(max, value)));
    return ((v - lo) / (hi - lo)) * width;
  };
}

/** Clean log ticks inside [min, max]. */
export function logTicks(min: number, max: number): number[] {
  const candidates = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  return candidates.filter((t) => t >= min && t <= max);
}

/** Linear "nice" ticks from 0 to >= max. */
export function linearTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step * 0.999; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

/** Deterministic 0..1 jitter from a string id, so dot positions are stable between renders. */
export function stableJitter(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** GitHub link for a brain-relative path in the private brain repo. */
export function brainSourceUrl(pathInBrain: string, commit?: string): string {
  const ref = commit && /^[0-9a-f]{6,40}$/i.test(commit) ? commit : 'main';
  const clean = pathInBrain.replace(/^\/+/, '').replace(/^brain\//, '');
  return `https://github.com/Xuberan-Build/quantum-brain/blob/${ref}/${clean.split('/').map(encodeURIComponent).join('/')}`;
}
