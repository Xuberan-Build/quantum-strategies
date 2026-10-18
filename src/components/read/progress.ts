/**
 * Resume within the browser session.
 *
 * The server identifies the visitor by its httpOnly `qs_read_token` cookie (set by
 * POST /api/read/start). The page keeps its own place: the session id in a session
 * cookie (no expiry, so it ends with the browser session) and the draft answers in
 * sessionStorage, which never leaves this tab. Every read and write is wrapped, so
 * the flow still works when storage is blocked.
 */
import type { ReadAnswers, ReadPreview, ReadQuestion, ReadUtm, Segment } from '@/lib/read/types';

export const SESSION_COOKIE = 'qs_read_sid';
const PROGRESS_KEY = 'qs_read_progress';
const previewKey = (sessionId: string) => `qs_read_preview:${sessionId}`;

export interface ReadProgress {
  sessionId: string;
  variant?: string;
  utm?: ReadUtm;
  segment?: Segment;
  answers: ReadAnswers;
  /** id of the question on screen */
  currentId?: string;
  /** last question list, so "show my answers" works on the support screen */
  questions?: ReadQuestion[];
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function readSessionCookie(): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function writeSessionCookie(sessionId: string | null) {
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = sessionId
      ? `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; SameSite=Lax${secure}`
      : `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // ignore
  }
}

export function loadProgress(): ReadProgress | null {
  try {
    const raw = storage()?.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReadProgress;
    if (!parsed?.sessionId || typeof parsed.answers !== 'object') return null;
    const cookieId = readSessionCookie();
    if (cookieId && cookieId !== parsed.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProgress(progress: ReadProgress) {
  try {
    storage()?.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
  writeSessionCookie(progress.sessionId);
}

export function clearProgress() {
  try {
    storage()?.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  writeSessionCookie(null);
}

export function savePreview(preview: ReadPreview) {
  try {
    storage()?.setItem(previewKey(preview.sessionId), JSON.stringify(preview));
  } catch {
    // ignore
  }
}

export function loadPreview(sessionId: string): ReadPreview | null {
  try {
    const raw = storage()?.getItem(previewKey(sessionId));
    return raw ? (JSON.parse(raw) as ReadPreview) : null;
  } catch {
    return null;
  }
}

/** Progress for a finished session (answers kept for "You said" and the support screen). */
export function loadProgressFor(sessionId: string): ReadProgress | null {
  try {
    const raw = storage()?.getItem(PROGRESS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ReadProgress) : null;
    return parsed?.sessionId === sessionId ? parsed : null;
  } catch {
    return null;
  }
}
