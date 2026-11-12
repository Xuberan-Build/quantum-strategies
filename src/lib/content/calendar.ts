// Channel labels and colours for the content calendar (derivative pieces from long-form posts).

export const PIECE_TYPES: Record<string, { label: string; color: string }> = {
  youtube_long: { label: 'YouTube long', color: '#ef4444' },
  short: { label: 'Short / Reel / TikTok', color: '#f97316' },
  ig_carousel: { label: 'IG carousel', color: '#ec4899' },
  ig_lettering: { label: 'IG lettering', color: '#d946ef' },
  social_ig: { label: 'IG caption', color: '#ec4899' },
  social_twitter: { label: 'X', color: '#64748b' },
  social_tiktok: { label: 'TikTok', color: '#14b8a6' },
  reddit: { label: 'Reddit answer', color: '#ff4500' },
  reddit_post: { label: 'Reddit post', color: '#ff5722' },
  x_article: { label: 'X Article', color: '#475569' },
  email: { label: 'Email', color: '#0ea5e9' },
  blog: { label: 'Blog', color: '#22c55e' },
};

export const PIECE_STATUSES = ['draft', 'review', 'approved', 'published'] as const;

export function pieceTypeLabel(t: string) {
  return PIECE_TYPES[t]?.label ?? t;
}

export function pieceTypeColor(t: string) {
  return PIECE_TYPES[t]?.color ?? '#94a3b8';
}

/** Monday-first weeks covering the month, as ISO date strings (YYYY-MM-DD). */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setUTCDate(1 - offset);
  const weeks: string[][] = [];
  const cur = new Date(start);
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (cur.getUTCMonth() === month - 1);
  return weeks;
}

/** Split a source body around the excerpt so the editor can highlight it. Whitespace-insensitive. */
export function locateExcerpt(body: string, excerpt: string | null): { before: string; match: string; after: string } | null {
  if (!excerpt) return null;
  const needle = excerpt.trim();
  const idx = body.indexOf(needle);
  if (idx >= 0) return { before: body.slice(0, idx), match: needle, after: body.slice(idx + needle.length) };
  // fall back to a whitespace-tolerant match on the first 80 characters
  const head = needle.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const m = new RegExp(head).exec(body);
  if (!m) return null;
  const end = Math.min(body.length, m.index + needle.length);
  return { before: body.slice(0, m.index), match: body.slice(m.index, end), after: body.slice(end) };
}
