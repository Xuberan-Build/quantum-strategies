/**
 * Human Design chart calculator.
 *
 * Implements gate-degree lookup, center activation, channel detection,
 * type/authority/profile/definition derivation from two EphemerisResult
 * snapshots (natal and design/unconscious).
 *
 * References:
 *  - Gate sequence and degree mapping: Rave Mandala / Jovian Archive
 *  - 36 channels: verified against humandesign.zone, humdes.info, geneticmatrix.com
 *  - Gate-to-center mapping: Ra Uru Hu's original BodyGraph
 */

import {
  EphemerisResult,
  HumanDesignChart,
  HDActivations,
  GateActivation,
  HDCenter,
  HDType,
  HDAuthority,
  HDDefinition,
} from './types';
import { norm360 } from './utils';

// ---------------------------------------------------------------------------
// Gate sequence
// ---------------------------------------------------------------------------

/**
 * 64 gates ordered around the Rave Mandala starting at 301.625° tropical
 * (~1°37′ Aquarius). Each gate spans 5.625°. Source: Jovian Archive / Ra Uru Hu.
 *
 * Gate 41 begins at 301.625°
 * Gate 19 begins at 307.25°
 * Gate 13 begins at 312.875°
 * … and so on, wrapping through 360°/0° back to 302°.
 */
const GATE_SEQUENCE: readonly number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2,  23, 8,  20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7,  4,  29, 59, 40, 64, 47, 6,  46, 18, 48, 57, 32, 50,
  28, 44, 1,  43, 14, 34, 9,  5,  26, 11, 10, 58, 38, 54, 61, 60,
];

/** Tropical longitude where Gate 41 (index 0) begins. Calibrated to 301.625° (~1°37' Aquarius).
 *  Valid range: 301.5°–301.75°. Confirmed against Austin Santos (1/3 Manifestor, self-reported). */
const GATE_START_DEGREE = 301.625;

/** Width of each gate in degrees (360 / 64). */
const GATE_WIDTH = 360 / 64; // 5.625°

/** Width of each line in degrees (GATE_WIDTH / 6). */
const LINE_WIDTH = GATE_WIDTH / 6; // 0.9375°

// ---------------------------------------------------------------------------
// Gate-to-center mapping
// ---------------------------------------------------------------------------

/**
 * Maps each of the 64 gates to its center.
 * Cross-referenced against Ra Uru Hu's original BodyGraph specification.
 */
const GATE_CENTERS: Readonly<Record<number, HDCenter>> = {
  // Head (pressure center – receives inspiration)
  64: 'Head', 61: 'Head', 63: 'Head',

  // Ajna (awareness center – conceptualising/processing)
  47: 'Ajna', 24: 'Ajna', 4: 'Ajna', 17: 'Ajna', 43: 'Ajna', 11: 'Ajna',

  // Throat (manifestation/communication center)
  62: 'Throat', 23: 'Throat', 56: 'Throat', 35: 'Throat', 12: 'Throat',
  45: 'Throat', 33: 'Throat', 8: 'Throat', 31: 'Throat', 20: 'Throat',
  16: 'Throat',

  // G / Identity center (love, direction, self)
  1: 'G', 2: 'G', 7: 'G', 10: 'G', 13: 'G', 15: 'G', 25: 'G', 46: 'G',

  // Will / Heart / Ego center (willpower, ego, material world)
  21: 'Will', 40: 'Will', 26: 'Will', 51: 'Will',

  // Solar Plexus (emotional motor / awareness center)
  22: 'Solar Plexus', 37: 'Solar Plexus', 36: 'Solar Plexus',
  30: 'Solar Plexus', 55: 'Solar Plexus', 49: 'Solar Plexus',
  6: 'Solar Plexus',

  // Sacral (life-force motor center – pure generating power)
  34: 'Sacral', 27: 'Sacral', 59: 'Sacral', 9: 'Sacral', 3: 'Sacral',
  14: 'Sacral', 42: 'Sacral', 5: 'Sacral', 29: 'Sacral',

  // Spleen (survival / intuition / immune awareness center)
  48: 'Spleen', 57: 'Spleen', 44: 'Spleen', 50: 'Spleen', 32: 'Spleen',
  28: 'Spleen', 18: 'Spleen',

  // Root (pressure / adrenal motor center)
  58: 'Root', 38: 'Root', 54: 'Root', 53: 'Root', 60: 'Root',
  52: 'Root', 19: 'Root', 39: 'Root', 41: 'Root',
};

// ---------------------------------------------------------------------------
// 36 Channels
// ---------------------------------------------------------------------------

/**
 * All 36 channels as [gateA, gateB] pairs.
 *
 * Authoritative list verified against:
 *  - humandesign.zone crash course
 *  - humdes.info channels
 *  - geneticmatrix.com channels index
 *
 * Notable Integration Circuit channels (gate 20 connects to three centers):
 *   10-20 (G → Throat), 20-34 (Sacral → Throat), 20-57 (Spleen → Throat)
 *   10-34 (G → Sacral), 10-57 (G → Spleen), 34-57 (Sacral → Spleen)
 */
const CHANNELS: ReadonlyArray<readonly [number, number]> = [
  // Head ↔ Ajna
  [64, 47],   // Channel of Abstraction
  [61, 24],   // Channel of Awareness
  [63, 4],    // Channel of Logic

  // Ajna ↔ Throat
  [17, 62],   // Channel of Acceptance
  [11, 56],   // Channel of Curiosity
  [43, 23],   // Channel of Structuring

  // G ↔ Throat
  [7, 31],    // Channel of the Alpha
  [1, 8],     // Channel of Inspiration
  [13, 33],   // Channel of the Prodigal
  [10, 20],   // Channel of Awakening (Integration)

  // Will ↔ Throat
  [21, 45],   // Channel of Money Line

  // Will ↔ G
  [51, 25],   // Channel of Initiation

  // Will ↔ Solar Plexus
  [40, 37],   // Channel of Community

  // Will ↔ Spleen
  [26, 44],   // Channel of Surrender

  // Solar Plexus ↔ Throat
  [22, 12],   // Channel of Openness
  [35, 36],   // Channel of Transitoriness

  // Solar Plexus ↔ Sacral
  [6, 59],    // Channel of Mating

  // Solar Plexus ↔ Root
  [30, 41],   // Channel of Recognition
  [49, 19],   // Channel of Synthesis
  [55, 39],   // Channel of Emoting

  // G ↔ Sacral
  [2, 14],    // Channel of the Beat
  [15, 5],    // Channel of Rhythm
  [46, 29],   // Channel of Discovery

  // Sacral ↔ Throat (Integration)
  [34, 20],   // Channel of Charisma

  // Sacral ↔ Spleen
  [27, 50],   // Channel of Preservation

  // Sacral ↔ Root
  [3, 60],    // Channel of Mutation
  [9, 52],    // Channel of Concentration
  [42, 53],   // Channel of Maturation

  // Spleen ↔ Throat (Integration)
  [57, 20],   // Channel of Brainwave

  // Spleen ↔ Root
  [28, 38],   // Channel of Struggle
  [32, 54],   // Channel of Transformation

  // G ↔ Spleen (Integration)
  [10, 57],   // Channel of Perfected Form

  // G ↔ Sacral (Integration – duplicate connection via different gates)
  [10, 34],   // Channel of Exploration (Integration)

  // Sacral ↔ Spleen (Integration)
  [34, 57],   // Channel of Power (Integration)

  // Spleen ↔ Throat
  [48, 16],   // Channel of the Wavelength

  // Root ↔ Spleen
  [58, 18],   // Channel of Judgment (Root → Spleen via correction)
] as const;

// ---------------------------------------------------------------------------
// Gate lookup
// ---------------------------------------------------------------------------

/**
 * Given a tropical ecliptic longitude, returns the Human Design gate and line.
 *
 * Algorithm:
 *   offset = (normalizedLng - GATE_START_DEGREE + 360) % 360
 *   gateIndex = floor(offset / GATE_WIDTH)        → 0..63
 *   line      = floor((offset % GATE_WIDTH) / LINE_WIDTH) + 1  → 1..6
 */
function gateFromLongitude(lng: number): { gate: number; line: 1 | 2 | 3 | 4 | 5 | 6 } {
  const normalizedLng = norm360(lng);
  const offset = norm360(normalizedLng - GATE_START_DEGREE);
  const gateIndex = Math.floor(offset / GATE_WIDTH);
  const lineRaw = Math.floor((offset % GATE_WIDTH) / LINE_WIDTH) + 1;
  // Clamp to 1–6 for floating-point safety
  const line = Math.min(6, Math.max(1, lineRaw)) as 1 | 2 | 3 | 4 | 5 | 6;
  const gate = GATE_SEQUENCE[gateIndex];
  return { gate, line };
}

/**
 * Build a GateActivation from a tropical longitude.
 */
function activationFromLng(lng: number): GateActivation {
  const { gate, line } = gateFromLongitude(lng);
  const center = GATE_CENTERS[gate];
  if (!center) {
    throw new Error(`No center mapping for gate ${gate}`);
  }
  return { gate, line, center };
}

// ---------------------------------------------------------------------------
// Activations builder
// ---------------------------------------------------------------------------

/**
 * Builds an HDActivations record for 13 planets from a single EphemerisResult.
 * Earth's longitude is always opposite the Sun (sun + 180°).
 */
function buildActivations(eph: EphemerisResult): HDActivations {
  const p = eph.planets;

  const sunLng = p.sun.tropicalLng;
  const earthLng = norm360(sunLng + 180);

  return {
    sun:      activationFromLng(sunLng),
    earth:    activationFromLng(earthLng),
    moon:     activationFromLng(p.moon.tropicalLng),
    northNode: activationFromLng(p.northNode.tropicalLng),
    southNode: activationFromLng(p.southNode.tropicalLng),
    mercury:  activationFromLng(p.mercury.tropicalLng),
    venus:    activationFromLng(p.venus.tropicalLng),
    mars:     activationFromLng(p.mars.tropicalLng),
    jupiter:  activationFromLng(p.jupiter.tropicalLng),
    saturn:   activationFromLng(p.saturn.tropicalLng),
    uranus:   activationFromLng(p.uranus.tropicalLng),
    neptune:  activationFromLng(p.neptune.tropicalLng),
    pluto:    activationFromLng(p.pluto.tropicalLng),
  };
}

// ---------------------------------------------------------------------------
// Defined gates / centers / channels
// ---------------------------------------------------------------------------

/** Collect all unique gate numbers from both conscious and unconscious activations. */
function collectDefinedGates(
  conscious: HDActivations,
  unconscious: HDActivations,
): Set<number> {
  const gates = new Set<number>();
  for (const act of [
    ...Object.values(conscious),
    ...Object.values(unconscious),
  ] as GateActivation[]) {
    gates.add(act.gate);
  }
  return gates;
}

/**
 * Given the set of defined gates, determine which channels are defined
 * (both gates of the pair are present) and which centers are therefore defined.
 */
function computeDefinedChannelsAndCenters(definedGates: Set<number>): {
  definedChannelKeys: Set<string>;
  definedCenters: Set<HDCenter>;
} {
  const definedChannelKeys = new Set<string>();
  const definedCenters = new Set<HDCenter>();

  for (const [a, b] of CHANNELS) {
    if (definedGates.has(a) && definedGates.has(b)) {
      // Store as lower-gate-first for canonical keys
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      definedChannelKeys.add(key);
      // Both endpoints' centers become defined
      const centerA = GATE_CENTERS[a];
      const centerB = GATE_CENTERS[b];
      if (centerA) definedCenters.add(centerA);
      if (centerB) definedCenters.add(centerB);
    }
  }

  // Also mark centers that have any defined gate even without a full channel
  // (gates can define a center even without completing a channel —
  //  actually in HD, centers are ONLY defined via complete channels.
  //  Lone gates do NOT define a center. We keep only channel-defined centers.)

  return { definedChannelKeys, definedCenters };
}

// ---------------------------------------------------------------------------
// Type derivation
// ---------------------------------------------------------------------------

/** Build center adjacency map from defined channel keys. Built once; reused for type and authority. */
function buildCenterAdjacency(channelKeys: Set<string>): Map<HDCenter, Set<HDCenter>> {
  const adj = new Map<HDCenter, Set<HDCenter>>();
  for (const [a, b] of CHANNELS) {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!channelKeys.has(key)) continue;
    const ca = GATE_CENTERS[a] as HDCenter;
    const cb = GATE_CENTERS[b] as HDCenter;
    if (!ca || !cb || ca === cb) continue;
    if (!adj.has(ca)) adj.set(ca, new Set());
    if (!adj.has(cb)) adj.set(cb, new Set());
    adj.get(ca)!.add(cb);
    adj.get(cb)!.add(ca);
  }
  return adj;
}

/** BFS from `start` center to Throat via the pre-built adjacency map. */
function isConnectedToThroat(start: HDCenter, adj: Map<HDCenter, Set<HDCenter>>): boolean {
  if (!adj.has(start)) return false;
  const visited = new Set<HDCenter>([start]);
  const queue: HDCenter[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === 'Throat') return true;
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
}

/**
 * Derive the Human Design Type from defined centers and channel connections.
 *
 * Priority logic:
 *  Reflector:             All 9 centers undefined
 *  Manifesting Generator: Sacral defined AND a motor is connected to Throat
 *  Manifestor:            No Sacral defined, but at least one motor (Will, Solar Plexus, Root)
 *                         is connected to Throat via defined channels
 *  Generator:             Sacral defined, no motor-to-Throat connection
 *  Projector:             Sacral not defined, no motor-to-Throat
 */
function deriveType(
  definedCenters: Set<HDCenter>,
  adj: Map<HDCenter, Set<HDCenter>>,
): HDType {
  if (definedCenters.size === 0) return 'Reflector';

  const sacralDefined = definedCenters.has('Sacral');
  const motors: HDCenter[] = ['Sacral', 'Will', 'Solar Plexus', 'Root'];
  const motorToThroat = motors.some(
    m => definedCenters.has(m) && isConnectedToThroat(m, adj),
  );

  if (sacralDefined && motorToThroat)  return 'Manifesting Generator';
  if (!sacralDefined && motorToThroat) return 'Manifestor';
  if (sacralDefined)                   return 'Generator';
  return 'Projector';
}

// ---------------------------------------------------------------------------
// Authority derivation
// ---------------------------------------------------------------------------

/**
 * Derive authority by highest defined center in the priority hierarchy.
 *
 * Priority (highest wins):
 *   1. Solar Plexus defined → Emotional
 *   2. Sacral defined        → Sacral
 *   3. Spleen defined        → Splenic
 *   4. Will defined          → Ego
 *   5. G defined with channel to Throat → Self-Projected
 *   6. Head or Ajna defined  → Mental
 *   7. Reflector             → Lunar
 *   8. (fallback)            → None
 */
function deriveAuthority(
  definedCenters: Set<HDCenter>,
  adj: Map<HDCenter, Set<HDCenter>>,
): HDAuthority {
  if (definedCenters.has('Solar Plexus')) return 'Emotional';
  if (definedCenters.has('Sacral'))       return 'Sacral';
  if (definedCenters.has('Spleen'))       return 'Splenic';
  if (definedCenters.has('Will'))         return 'Ego';

  // Self-Projected: G center has a direct defined channel to Throat (7-31, 1-8, 13-33, 10-20)
  if (definedCenters.has('G') && adj.get('G')?.has('Throat')) return 'Self-Projected';

  if (definedCenters.has('Head') || definedCenters.has('Ajna')) return 'Mental';
  if (definedCenters.size === 0) return 'Lunar';
  return 'None';
}

// ---------------------------------------------------------------------------
// Definition (connected components)
// ---------------------------------------------------------------------------

/**
 * Count independent groups of defined centers connected by defined channels.
 *
 * Uses Union-Find over the set of defined centers.
 */
function deriveDefinition(
  definedCenters: Set<HDCenter>,
  channelKeys: Set<string>,
): HDDefinition {
  if (definedCenters.size === 0) return 'None';

  const centers = Array.from(definedCenters);
  const parent = new Map<HDCenter, HDCenter>();
  for (const c of centers) parent.set(c, c);

  function find(c: HDCenter): HDCenter {
    if (parent.get(c) !== c) {
      parent.set(c, find(parent.get(c)!));
    }
    return parent.get(c)!;
  }

  function union(a: HDCenter, b: HDCenter) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  // For each defined channel, union the two centers it connects
  for (const [a, b] of CHANNELS) {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!channelKeys.has(key)) continue;
    const ca = GATE_CENTERS[a] as HDCenter;
    const cb = GATE_CENTERS[b] as HDCenter;
    if (ca && cb && definedCenters.has(ca) && definedCenters.has(cb)) {
      union(ca, cb);
    }
  }

  // Count unique roots among defined centers
  const roots = new Set(centers.map(c => find(c)));
  const groups = roots.size;

  switch (groups) {
    case 1:  return 'Single';
    case 2:  return 'Split';
    case 3:  return 'Triple Split';
    case 4:  return 'Quadruple Split';
    default: return 'None';
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Profile = "${conscious sun line}/${unconscious sun line}".
 * Conscious = natal (birth) Sun activation.
 * Unconscious = design (88.736° earlier) Sun activation.
 */
function deriveProfile(conscious: HDActivations, unconscious: HDActivations): string {
  return `${conscious.sun.line}/${unconscious.sun.line}`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build a complete Human Design chart from two EphemerisResult snapshots.
 *
 * @param natalEphemeris   – ephemeris at the birth moment (conscious / personality)
 * @param designEphemeris  – ephemeris at the design moment (~88 days before birth, unconscious)
 * @param designDate       – the UTC Date of the design moment
 */
export function buildHumanDesignChart(
  natalEphemeris: EphemerisResult,
  designEphemeris: EphemerisResult,
  designDate: Date,
): HumanDesignChart {
  // 1. Compute activations for conscious (natal) and unconscious (design) layers
  const conscious   = buildActivations(natalEphemeris);
  const unconscious = buildActivations(designEphemeris);

  // 2. Collect all defined gates (union of both layers)
  const definedGates = collectDefinedGates(conscious, unconscious);

  // 3. Determine defined channels and centers
  const { definedChannelKeys, definedCenters } =
    computeDefinedChannelsAndCenters(definedGates);

  // 4. Build center adjacency once — reused for type and authority derivation
  const adj = buildCenterAdjacency(definedChannelKeys);

  // 5. Derive all HD properties
  const type       = deriveType(definedCenters, adj);
  const authority  = deriveAuthority(definedCenters, adj);
  const profile    = deriveProfile(conscious, unconscious);
  const definition = deriveDefinition(definedCenters, definedChannelKeys);

  // 6. Split defined/undefined centers
  const ALL_CENTERS: HDCenter[] = [
    'Head', 'Ajna', 'Throat', 'G', 'Will',
    'Solar Plexus', 'Sacral', 'Spleen', 'Root',
  ];
  const definedCentersArr   = ALL_CENTERS.filter(c => definedCenters.has(c));
  const undefinedCentersArr = ALL_CENTERS.filter(c => !definedCenters.has(c));

  return {
    type,
    authority,
    profile,
    definition,
    designDate,
    conscious,
    unconscious,
    definedCenters:   definedCentersArr,
    undefinedCenters: undefinedCentersArr,
    definedChannels:  Array.from(definedChannelKeys),
  };
}
