'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clampIndex } from './deckNavigation';

interface Options {
  count: number;
  initialIndex?: number;
  /** Sync `?s=` into the URL without a navigation. */
  syncUrl?: boolean;
}

export function useDeckNavigation({ count, initialIndex = 0, syncUrl = true }: Options) {
  const [state, setState] = useState(() => ({ index: clampIndex(initialIndex, count), direction: 0 as -1 | 0 | 1 }));
  const first = useRef(true);

  const go = useCallback(
    (target: number) => {
      setState((prev) => {
        const index = clampIndex(target, count);
        if (index === prev.index) return prev;
        return { index, direction: index > prev.index ? 1 : -1 };
      });
    },
    [count],
  );

  const next = useCallback(() => setState((p) => (p.index >= count - 1 ? p : { index: p.index + 1, direction: 1 })), [count]);
  const prev = useCallback(() => setState((p) => (p.index <= 0 ? p : { index: p.index - 1, direction: -1 })), []);

  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;
    if (first.current) {
      first.current = false;
      // Leave a clean URL on first paint unless the deep link already asked for a slide.
      if (state.index === 0 && !window.location.search.includes('s=')) return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('s', String(state.index + 1));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [state.index, syncUrl]);

  return {
    index: state.index,
    direction: state.direction,
    isFirst: state.index === 0,
    isLast: state.index >= count - 1,
    go,
    next,
    prev,
    first: useCallback(() => go(0), [go]),
    last: useCallback(() => go(count - 1), [go, count]),
  };
}
