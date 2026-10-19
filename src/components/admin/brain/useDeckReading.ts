'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deckReadStatus, type DeckReadRow, type DeckReadState, type DeckReadStatus } from '@/lib/brain/deck-reads';

export interface DeckReadingProps {
  /** deckContentHash of the deck being shown. */
  contentHash: string;
  /** The signed-in admin's receipt for this deck, if any. */
  initial: DeckReadState | null;
  /** Set when read status could not be loaded (e.g. the migration is not applied yet). */
  error?: string;
}

const ENDPOINT = '/api/admin/brain/deck-reads';

async function post(body: Record<string, unknown>): Promise<DeckReadRow> {
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { row?: DeckReadRow; error?: string };
  if (!res.ok || !json.row) throw new Error(json.error || `Save failed (${res.status})`);
  return json.row;
}

/**
 * Read receipt for one deck: status, mark read/unread (optimistic), and debounced progress
 * saving for resume. Does nothing when `reading` is undefined.
 */
export function useDeckReading(deckId: string, reading: DeckReadingProps | undefined, progressDelay = 700) {
  const [state, setState] = useState<DeckReadState | null>(reading?.initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status: DeckReadStatus = deckReadStatus(state, reading?.contentHash);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRead = useCallback(
    async (read: boolean, lastSlide?: number) => {
      if (!reading) return;
      const prev = state;
      const now = new Date().toISOString();
      setState((s) => ({
        last_slide: lastSlide ?? s?.last_slide ?? 0,
        read_at: read ? now : null,
        content_hash: read ? reading.contentHash : s?.content_hash ?? null,
      }));
      setBusy(true);
      setError(null);
      try {
        const row = await post({
          deck_id: deckId,
          read,
          ...(read ? { content_hash: reading.contentHash } : {}),
          ...(lastSlide !== undefined ? { last_slide: lastSlide } : {}),
        });
        setState({ read_at: row.read_at, content_hash: row.content_hash, last_slide: row.last_slide });
      } catch (err) {
        setState(prev);
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setBusy(false);
      }
    },
    [deckId, reading, state],
  );

  const saveProgress = useCallback(
    (index: number) => {
      if (!reading || reading.error) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        setState((s) => (s ? { ...s, last_slide: index } : { read_at: null, content_hash: null, last_slide: index }));
        post({ deck_id: deckId, last_slide: index }).catch(() => undefined); // best effort
      }, progressDelay);
    },
    [deckId, reading, progressDelay],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useMemo(
    () => ({ enabled: Boolean(reading), state, status, busy, error, setRead, saveProgress }),
    [reading, state, status, busy, error, setRead, saveProgress],
  );
}
