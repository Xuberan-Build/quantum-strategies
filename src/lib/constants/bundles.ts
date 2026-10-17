/**
 * Rite bundles sold from code. Each bundle expands to its member products.
 * Safe to import from client and server code (no server dependencies).
 */

export const BUNDLE_CONTENTS: Record<string, string[]> = {
  'perception-rite-bundle': [
    'perception-rite-scan-1',
    'perception-rite-scan-2',
    'perception-rite-scan-3',
    'perception-rite-scan-4',
    'perception-rite-scan-5',
  ],
  'orientation-bundle': ['personal-alignment', 'business-alignment', 'brand-alignment'],
  'declaration-rite-bundle': [
    'declaration-rite-life-vision',
    'declaration-rite-business-model',
    'declaration-rite-strategic-path',
  ],
};

/** Display name and sales page for each Rite bundle. */
export const RITE_INFO: Record<string, { name: string; pagePath: string }> = {
  'perception-rite-bundle': { name: 'Perception', pagePath: '/products/perception' },
  'orientation-bundle': { name: 'Orientation', pagePath: '/products/orientation' },
  'declaration-rite-bundle': { name: 'Declaration', pagePath: '/products/declaration' },
};
