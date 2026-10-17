/**
 * Node id rules. Every id is `<type>:<slug>` and stable across builds:
 * - slugs are lowercase a-z, 0-9 and hyphens only (no dots, underscores, spaces, quotes or parentheses), max 120 chars;
 * - brain notes use the admin doc slug (src/lib/brain/archive.ts docSlug): `note:gtm--problem-solution-map`;
 * - records that have no natural key use a short content hash: `quote:yt-<hash>`;
 * - corpus sources use the knowledge_sources uuid, or `<tradition>.<text_name>` when the
 *   chunks' text has no knowledge_sources row (dots and underscores become hyphens).
 */
import { createHash } from 'node:crypto';
import { docSlug } from '../../../../src/lib/brain/archive';
import type { NodeType } from './types';

export const ID_PATTERN = /^[a-z_]+:[a-z0-9][a-z0-9-]{0,119}$/;

export function slugify(text: string, max = 80): string {
  const s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/→/g, ' to ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, max).replace(/-+$/, '') || 'x';
}

export function shortHash(...parts: string[]): string {
  return createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 12);
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** `<type>:<slug>`; the slug is normalised (ids are case-insensitive by construction). */
export function nodeId(type: NodeType, slug: string): string {
  const clean = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+$/g, '')
    .slice(0, 120);
  return `${type}:${clean || 'x'}`;
}

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

/** Brain-relative markdown path -> note id (same slug the admin docs reader uses). */
export function noteId(brainPath: string): string {
  return nodeId('note', docSlug(brainPath));
}

export function docId(brainPath: string): string {
  return nodeId('doc', docSlug(brainPath));
}
