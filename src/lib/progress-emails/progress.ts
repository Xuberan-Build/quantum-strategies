/**
 * Where one user is in the Three Rites, as a plain snapshot. Pure: no I/O.
 *
 * Order comes from RITE_STAGES (canon: Perception, Orientation, Declaration).
 * The next step is the first product the user owns and hasn't completed, in that order.
 */
import { PRODUCTS } from '@/lib/constants/products';
import { RITE_STAGES, type RiteStage } from '@/lib/profile/rite-journey';

export type RiteKey = RiteStage;

export const RITE_ORDER: readonly RiteKey[] = RITE_STAGES.map((r) => r.key);

export const RITE_NAMES = Object.fromEntries(RITE_STAGES.map((r) => [r.key, r.label])) as Record<RiteKey, string>;

const RITE_SLUGS = Object.fromEntries(RITE_STAGES.map((r) => [r.key, r.products])) as Record<RiteKey, readonly string[]>;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccessRow {
  product_slug: string;
  completed_at: string | null;
}

export interface SessionRow {
  product_slug: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Completion on the access row, falling back to a completed session. Older
 * completions were only ever recorded on the session.
 */
export function withSessionCompletions(access: AccessRow[], sessions: SessionRow[]): AccessRow[] {
  const sessionDone = new Map<string, string>();
  for (const s of sessions) {
    if (!s.completed_at) continue;
    const prev = sessionDone.get(s.product_slug);
    if (!prev || Date.parse(s.completed_at) > Date.parse(prev)) sessionDone.set(s.product_slug, s.completed_at);
  }
  return access.map((r) => ({ ...r, completed_at: r.completed_at ?? sessionDone.get(r.product_slug) ?? null }));
}

export function latestSessionUpdate(sessions: SessionRow[]): string | null {
  return latest(sessions.map((s) => s.updated_at));
}

export interface SnapshotInput {
  user: {
    id: string;
    email: string;
    name: string | null;
    discordUsername: string | null;
    phone: string | null;
    createdAt: string;
  };
  access: AccessRow[];
  /** Most recent product_sessions.updated_at for this user, if any. */
  lastSessionAt: string | null;
  prefs: { progress: boolean; newsletter: boolean };
}

export interface RiteProgress {
  key: RiteKey;
  name: string;
  done: number;
  /** Products in this Rite the user owns. */
  owned: number;
  complete: boolean;
  /** Latest completion in this Rite, when the Rite is complete. */
  completedAt: string | null;
}

export interface NextStep {
  rite: RiteKey;
  slug: string;
  productName: string;
}

export interface ProgressSnapshot {
  user: SnapshotInput['user'];
  prefs: SnapshotInput['prefs'];
  rites: RiteProgress[];
  next: NextStep | null;
  started: boolean;
  /** Owns at least one Rite product. Nobody else gets progress emails. */
  eligible: boolean;
  /** Last session update or completion, if they've ever done anything. */
  lastActivityAt: string | null;
  /** When the current quiet stretch began: last activity, else when they joined. */
  idleSince: string;
  daysIdle: number;
}

function latest(dates: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const d of dates) if (d && (!best || Date.parse(d) > Date.parse(best))) best = d;
  return best;
}

export function productName(slug: string): string {
  return PRODUCTS[slug]?.name ?? slug;
}

export function buildSnapshot(input: SnapshotInput, now: Date): ProgressSnapshot {
  const owned = new Map(input.access.map((r) => [r.product_slug, r]));

  const rites: RiteProgress[] = RITE_ORDER.map((key) => {
    const rows = RITE_SLUGS[key].map((slug) => owned.get(slug)).filter((r): r is AccessRow => Boolean(r));
    const doneRows = rows.filter((r) => r.completed_at);
    const complete = rows.length > 0 && doneRows.length === rows.length;
    return {
      key,
      name: RITE_NAMES[key],
      done: doneRows.length,
      owned: rows.length,
      complete,
      completedAt: complete ? latest(doneRows.map((r) => r.completed_at)) : null,
    };
  });

  let next: NextStep | null = null;
  for (const key of RITE_ORDER) {
    const slug = RITE_SLUGS[key].find((s) => owned.has(s) && !owned.get(s)!.completed_at);
    if (slug) {
      next = { rite: key, slug, productName: productName(slug) };
      break;
    }
  }

  const lastActivityAt = latest([input.lastSessionAt, ...input.access.map((r) => r.completed_at)]);
  const idleSince = lastActivityAt ?? input.user.createdAt;

  return {
    user: input.user,
    prefs: input.prefs,
    rites,
    next,
    started: rites.some((r) => r.done > 0) || Boolean(input.lastSessionAt),
    eligible: rites.some((r) => r.owned > 0),
    lastActivityAt,
    idleSince,
    daysIdle: Math.max(0, Math.floor((now.getTime() - Date.parse(idleSince)) / DAY_MS)),
  };
}

/** "Perception 4 of 5" for each Rite the user owns. */
export function progressLines(s: ProgressSnapshot): string[] {
  return s.rites.filter((r) => r.owned > 0).map((r) => `${r.name}: ${r.done} of ${r.owned}${r.complete ? ' (complete)' : ''}`);
}
