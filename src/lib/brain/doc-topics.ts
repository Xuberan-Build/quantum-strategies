/** Topic labels for brain docs, derived from their brain-relative path. Pure, shared by server and client. */

export interface DocTopic {
  id: string;
  label: string;
}

const RULES: { test: (path: string) => boolean; topic: DocTopic }[] = [
  { test: (p) => p.startsWith('content/pipeline/runs/'), topic: { id: 'scripts', label: 'Scripts & runs' } },
  { test: (p) => p.startsWith('content/narrative/'), topic: { id: 'narrative', label: 'Narrative' } },
  { test: (p) => p.startsWith('content/production/'), topic: { id: 'production', label: 'Production' } },
  { test: (p) => p.startsWith('content/'), topic: { id: 'content', label: 'Content system' } },
  { test: (p) => p.startsWith('gtm/'), topic: { id: 'gtm', label: 'Go-to-market' } },
  { test: (p) => p.startsWith('research/'), topic: { id: 'research', label: 'Research' } },
  { test: (p) => p.startsWith('strategy/'), topic: { id: 'strategy', label: 'Strategy' } },
  { test: (p) => p.startsWith('decisions/'), topic: { id: 'decisions', label: 'Decisions' } },
  { test: (p) => p.startsWith('feedback/'), topic: { id: 'feedback', label: 'Feedback' } },
  { test: (p) => p.startsWith('journey/'), topic: { id: 'journey', label: 'Build journal' } },
  { test: (p) => p.startsWith('products/'), topic: { id: 'products', label: 'Products' } },
];

export function docTopic(path: string): DocTopic {
  for (const r of RULES) if (r.test(path)) return r.topic;
  const first = path.includes('/') ? path.slice(0, path.indexOf('/')) : 'other';
  return { id: first, label: first.charAt(0).toUpperCase() + first.slice(1).replace(/-/g, ' ') };
}

/** The run name for docs inside content/pipeline/runs/<run>/, e.g. "2026-11-11-caliber". */
export function docRun(path: string): string | null {
  const m = /^content\/pipeline\/runs\/([^/]+)\//.exec(path);
  return m ? m[1] : null;
}

export type DocSort = 'newest' | 'oldest' | 'title' | 'folder';
export const DOC_SORTS: { id: DocSort; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'title', label: 'Title A to Z' },
  { id: 'folder', label: 'By folder' },
];
