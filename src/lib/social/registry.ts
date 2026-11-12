/**
 * Adapter registry. Each platform agent owns its own file in ./adapters/ and exports `<platform>Adapter`.
 */
import type { Platform, PlatformAdapter } from './types';
import { youtubeAdapter } from './adapters/youtube';
import { instagramAdapter } from './adapters/instagram';
import { tiktokAdapter } from './adapters/tiktok';
import { xAdapter } from './adapters/x';

export const ADAPTERS: Partial<Record<Platform, PlatformAdapter>> = {
  youtube: youtubeAdapter,
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
  x: xAdapter,
};

export function getAdapter(platform: Platform): PlatformAdapter {
  const a = ADAPTERS[platform];
  if (!a) throw new Error(`No adapter for ${platform}`);
  return a;
}

export function isConfigured(platform: Platform): boolean {
  const a = ADAPTERS[platform];
  return !!a && a.requiredEnv.every((k) => !!process.env[k]);
}

/** OAuth redirect URI for a platform: <SITE>/api/admin/social/oauth/<platform>/callback */
export function redirectUriFor(platform: Platform): string {
  const base = (process.env.SOCIAL_OAUTH_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/api/admin/social/oauth/${platform}/callback`;
}
