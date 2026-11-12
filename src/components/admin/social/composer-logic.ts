/** Pure helpers for the composer: default formats, default options, character limits. */
import type { Format, Platform, SocialMedia, TargetOptions } from '@/lib/social/types';

export interface MediaShape {
  type: 'image' | 'video';
  width?: number;
  height?: number;
  durationSec?: number;
}

/** Per-account composer state. `format: null` = follow the automatic default for the current media. */
export interface TargetState {
  format: Format | null;
  captionOverride: string | null;
  options: TargetOptions;
}

export function defaultFormat(platform: Platform, allowed: Format[], media: MediaShape[]): Format {
  const videos = media.filter((m) => m.type === 'video');
  const pick = (...prefs: Format[]) => prefs.find((f) => allowed.includes(f)) ?? allowed[0] ?? prefs[0];
  switch (platform) {
    case 'instagram':
      if (media.length === 1 && videos.length === 1) return pick('reel', 'trial_reel');
      if (media.length > 1) return pick('carousel', 'image');
      return pick('image', 'carousel');
    case 'youtube': {
      const v = videos[0];
      const vertical = v?.width && v?.height ? v.height > v.width : false;
      const short = vertical && (v?.durationSec ?? 0) > 0 && (v?.durationSec ?? 0) <= 180;
      return short ? pick('short', 'video') : pick('video', 'short');
    }
    case 'tiktok':
      return videos.length ? pick('tiktok_video', 'tiktok_photo') : pick('tiktok_photo', 'tiktok_video');
    case 'x':
    case 'threads':
    default:
      return pick('tweet', 'thread');
  }
}

export function defaultOptions(platform: Platform): TargetOptions {
  switch (platform) {
    case 'instagram':
      return { shareToFeed: true, trialGraduation: 'MANUAL' };
    case 'youtube':
      return { ytPrivacy: 'public', ytMadeForKids: false };
    case 'tiktok':
      return { ttPrivacy: 'PUBLIC_TO_EVERYONE', ttMode: 'direct', ttDisableComment: false, ttDisableDuet: false, ttDisableStitch: false };
    case 'x':
      return { linkInReply: true };
    default:
      return {};
  }
}

/** Caption limit per platform (YouTube: description). X/Threads apply per post part. */
export const CAPTION_LIMITS: Record<Platform, number> = {
  x: 280,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
  threads: 500,
};

export const YT_TITLE_LIMIT = 100;

const URL_RE = /https?:\/\/\S+/g;

/** Approximate character count as the platform sees it. X counts every URL as 23. */
export function countChars(platform: Platform, text: string): number {
  if (platform === 'x') {
    const urls = text.match(URL_RE) ?? [];
    const rest = text.replace(URL_RE, '');
    return [...rest].length + urls.length * 23;
  }
  return [...text].length;
}

/** Split text into parts of at most `limit` chars, breaking on `---` lines, then paragraphs, then words. */
export function splitIntoParts(text: string, limit = 280): string[] {
  const explicit = text.split(/\n\s*---\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of explicit) {
    if ([...block].length <= limit) {
      out.push(block);
      continue;
    }
    let cur = '';
    for (const word of block.split(/(\s+)/)) {
      if ([...(cur + word)].length > limit && cur.trim()) {
        out.push(cur.trim());
        cur = word.trimStart();
      } else {
        cur += word;
      }
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out.length ? out : [''];
}

export function isVideoFormat(f: Format): boolean {
  return ['reel', 'trial_reel', 'video', 'short', 'tiktok_video'].includes(f);
}

export function mediaShapes(media: (SocialMedia | MediaShape)[]): MediaShape[] {
  return media.map((m) => ({ type: m.type, width: m.width, height: m.height, durationSec: m.durationSec }));
}
