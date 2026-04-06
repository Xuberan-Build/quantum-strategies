/**
 * Shared utility for validating placements
 * Used by both server and client to ensure consistent logic
 */

export interface HumanDesignCenters {
  head?: string;
  ajna?: string;
  throat?: string;
  g_identity?: string;
  heart_ego?: string;
  solar_plexus?: string;
  sacral?: string;
  spleen?: string;
  root?: string;
}

export interface Placements {
  astrology?: {
    sun?: string;
    moon?: string;
    rising?: string;
    mercury?: string;
    venus?: string;
    mars?: string;
    jupiter?: string;
    saturn?: string;
    uranus?: string;
    neptune?: string;
    pluto?: string;
    houses?: string;
    [key: string]: string | undefined;
  };
  human_design?: {
    type?: string;
    profile?: string;
    authority?: string;
    strategy?: string;
    definition?: string;
    not_self_theme?: string;
    incarnation_cross?: string;
    digestion?: string;
    environment?: string;
    sign?: string;
    strongest_sense?: string;
    primary_gift?: string;
    other_gifts?: string;
    design_gates?: number[];
    personality_gates?: number[];
    centers?: HumanDesignCenters | string;
    // legacy
    channels?: string;
    gifts?: string;
    [key: string]: unknown;
  };
  notes?: string;
}

/**
 * Check if placements are empty or invalid
 * Placements are considered empty if:
 * - null or undefined
 * - No valid astrology data (all unknown/empty)
 * - No valid human design data (all unknown/empty)
 * - No notes
 */
export function isPlacementsEmpty(placements: Placements | null | undefined): boolean {
  if (!placements) return true;

  const astro = placements.astrology || {};
  const hd = placements.human_design || {};

  // Check if astrology has any valid values
  const astroHas = Object.values(astro).some(
    (v) => v && String(v).trim() && String(v).trim().toUpperCase() !== 'UNKNOWN'
  );

  // Check if human design has any valid values (handle arrays, objects, and strings)
  const hdHas = Object.values(hd).some((v) => {
    if (!v) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.values(v as object).some((cv) => cv && cv !== 'UNKNOWN');
    return String(v).trim() && String(v).trim().toUpperCase() !== 'UNKNOWN';
  });

  // Check if notes exist
  const notesHas =
    placements.notes && typeof placements.notes === 'string' && placements.notes.trim().length > 0;

  // Placements are NOT empty if any of the above are true
  return !(astroHas || hdHas || notesHas);
}
