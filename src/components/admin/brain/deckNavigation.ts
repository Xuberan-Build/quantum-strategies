/** Pure deck-navigation helpers, shared by the server page and the client presenter. */

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

/** `?s=3` is 1-based; returns a 0-based index, defaulting to the first slide. */
export function parseSlideParam(value: string | string[] | null | undefined, count: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? clampIndex(n - 1, count) : 0;
}

export type DeckAction = 'next' | 'prev' | 'first' | 'last' | 'fullscreen' | 'sources' | 'close';

const INTERACTIVE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);

/**
 * Maps a key event to a deck action. Space and Enter are left alone on interactive
 * elements so buttons and links keep their native behaviour; typing is never hijacked.
 */
export function keyToAction(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>, target: EventTarget | null): DeckAction | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const el = target instanceof HTMLElement ? target : null;
  const tag = el?.tagName ?? '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return null;
  const onInteractive = INTERACTIVE.has(tag) || el?.getAttribute('role') === 'button';

  switch (event.key) {
    case 'ArrowRight':
    case 'PageDown':
      return 'next';
    case 'ArrowLeft':
    case 'PageUp':
      return 'prev';
    case ' ':
    case 'Spacebar':
      if (onInteractive) return null;
      return event.shiftKey ? 'prev' : 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'f':
    case 'F':
      return 'fullscreen';
    case 's':
    case 'S':
      return 'sources';
    case 'Escape':
      return 'close';
    default:
      return null;
  }
}
