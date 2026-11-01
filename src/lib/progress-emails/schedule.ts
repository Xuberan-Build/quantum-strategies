/**
 * Which progress email (if any) a user should get today, and whether Austin should
 * hear that they've fallen behind. Pure: no I/O, `now` is passed in.
 *
 * Every email has a dedupe key; a key that's already in the user's history is never
 * sent again. Keys tied to a quiet stretch use the date that stretch began, so new
 * activity starts a fresh stretch with fresh nudges.
 */
import { RITE_ORDER, type ProgressSnapshot, type RiteKey } from './progress';

export type ProgressEmailKind = 'complete' | 'reentry' | 'nudge10' | 'nudge4' | 'weekly';

export interface Decision {
  kind: ProgressEmailKind;
  key: string;
  /** For 'complete': the Rite just finished. */
  rite?: RiteKey;
}

export interface SentRecord {
  key: string;
  /** When it was claimed or sent. */
  at: string;
}

export const RULES = {
  /** A completion note only goes out if the Rite was finished this recently. */
  completionFreshDays: 7,
  /** Quiet this long, and they get the one-time re-entry email. */
  reentryIdleDays: 14,
  /** Nudge windows, in days idle: [from, to). Past the last window, the weekly email carries it. */
  nudge4: [4, 10] as const,
  nudge10: [10, 21] as const,
  /** Quiet this long, and Austin gets an alert to call them. */
  alertIdleDays: 7,
  /** No two user emails closer than this (completion notes are exempt). */
  minGapDays: 3,
  /** Weekly summary goes out on this weekday in Pacific time (1 = Monday). */
  weeklyWeekday: 1,
};

const TZ = 'America/Los_Angeles';
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in Pacific time. */
export function pacificDay(d: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}

function pacificWeekday(d: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** ISO week key, e.g. 2026-W45, for the Pacific calendar date. */
export function isoWeek(d: Date): string {
  const [y, m, day] = pacificDay(d).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const inWindow = (days: number, [from, to]: readonly [number, number]) => days >= from && days < to;

const daysBetween = (a: Date, b: string) => (a.getTime() - Date.parse(b)) / DAY_MS;

export function decideUserEmail(s: ProgressSnapshot, history: SentRecord[], now: Date): Decision | null {
  if (!s.eligible || !s.prefs.progress) return null;
  const sent = new Set(history.map((h) => h.key));

  // 1. A Rite finished recently. Exempt from the gap: it's a reply to something they did.
  for (const key of RITE_ORDER) {
    const r = s.rites.find((x) => x.key === key)!;
    if (r.complete && r.completedAt && daysBetween(now, r.completedAt) <= RULES.completionFreshDays && !sent.has(`complete:${key}`)) {
      return { kind: 'complete', key: `complete:${key}`, rite: key };
    }
  }

  if (!s.next) return null; // finished everything they own

  const lastSent = history
    .filter((h) => isUserFacingKey(h.key))
    .reduce<string | null>((acc, h) => (!acc || h.at > acc ? h.at : acc), null);
  if (lastSent && daysBetween(now, lastSent) < RULES.minGapDays) return null;

  const stretch = pacificDay(s.idleSince);

  // 2. Long quiet: one re-entry email, ever.
  if (s.daysIdle >= RULES.reentryIdleDays && !sent.has('reentry')) return { kind: 'reentry', key: 'reentry' };

  // 3. Nudges inside the current quiet stretch.
  if (inWindow(s.daysIdle, RULES.nudge10) && !sent.has(`nudge10:${stretch}`)) return { kind: 'nudge10', key: `nudge10:${stretch}` };
  if (inWindow(s.daysIdle, RULES.nudge4) && !sent.has(`nudge4:${stretch}`)) return { kind: 'nudge4', key: `nudge4:${stretch}` };

  // 4. Weekly summary.
  const week = `weekly:${isoWeek(now)}`;
  if (pacificWeekday(now) === RULES.weeklyWeekday && !sent.has(week)) return { kind: 'weekly', key: week };

  return null;
}

/** Austin hears once per quiet stretch, regardless of the user's email preferences. */
export function decideFounderAlert(s: ProgressSnapshot, history: SentRecord[]): { key: string } | null {
  if (!s.eligible || !s.next || s.daysIdle < RULES.alertIdleDays) return null;
  const key = `alert:${pacificDay(s.idleSince)}`;
  return history.some((h) => h.key === key) ? null : { key };
}

/** Founder-alert keys are internal; they never count toward a user's email gap. */
export function isUserFacingKey(key: string): boolean {
  return !key.startsWith('alert:');
}
