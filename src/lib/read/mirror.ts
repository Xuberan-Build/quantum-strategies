/**
 * The Perception Read: the week mirror (spec v3 §3.2, block 0).
 *
 * Static, built only from Q7. It opens every result before the pattern name and the gate.
 * Rules:
 *   - 6+ hours: "That's real time." No invented gap (showsGap false).
 *   - "instead" skipped: line two stops after the hours.
 *   - Q7 text that trips tier 2 (or worse): "the thing you named", never quoted.
 *   - No "values", "aligned" or "misaligned" (naming rule N11).
 * Tier 1 shows no mirror at all; the caller (preview/result) drops it.
 */
import { HOURS_BANDS, partString } from './questions';
import { isUsableText, screenText } from './safety';
import type { ReadAnswers, WeekMirror } from './types';

/** How the "instead" tap reads at the start of a sentence, in the audience's words. */
export const INSTEAD_PHRASES: Record<string, string | null> = {
  'instead:work': 'Work for someone else',
  'instead:others': "Other people's asks",
  'instead:shoulds': 'Things you thought you should do',
  'instead:projects': 'Your other projects',
  'instead:scroll': 'Scrolling or switching off',
  'instead:unsure': null, // "Not sure" doesn't name anything, so the line stops after the hours
};

const GAP_LIMIT_HOURS = 6;

function hoursTag(answers: ReadAnswers): string | null {
  const a = answers.q7;
  if (!a) return null;
  const raw = a.parts?.hours ?? a.number;
  if (typeof raw === 'string') {
    const t = raw.startsWith('hours:') ? raw : `hours:${raw}`;
    return HOURS_BANDS[t] ? t : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    if (raw === 0) return 'hours:0';
    if (raw <= 2) return 'hours:1_2';
    if (raw <= 5) return 'hours:3_5';
    if (raw <= 10) return 'hours:6_10';
    return 'hours:10_plus';
  }
  return null;
}

/** Normalises the want-or-should part ('own:want' or 'want'). */
export function wantOrShouldOf(answers: ReadAnswers): WeekMirror['wantOrShould'] {
  const raw = partString(answers, 'q7', 'wantOrShould');
  if (!raw) return null;
  const v = raw.replace(/^own:/, '');
  return v === 'want' || v === 'should' || v === 'unsure' ? v : null;
}

export function instead(answers: ReadAnswers): string | null {
  const raw = partString(answers, 'q7', 'instead');
  if (!raw) return null;
  const t = raw.startsWith('instead:') ? raw : `instead:${raw}`;
  return t in INSTEAD_PHRASES ? t : null;
}

/** The Q7 hours as a tag ('hours:1_2'), or null. Exported for the scorer. */
export function q7HoursTag(answers: ReadAnswers): string | null {
  return hoursTag(answers);
}

/** Strip wrapping quotes and a trailing full stop so the thing sits inside our quotes cleanly. */
function cleanThing(thing: string): string {
  return thing.trim().replace(/^["'“‘]+|["'”’]+$/g, '').replace(/[.]+$/, '').trim();
}

export function buildWeekMirror(answers: ReadAnswers): WeekMirror {
  const rawThing = partString(answers, 'q7', 'thing') ?? (answers.q7?.text?.trim() || null);
  const thingSafe = rawThing ? isUsableText(screenText(rawThing)) : true;
  const thing = rawThing && thingSafe ? cleanThing(rawThing) || null : null;

  const tag = hoursTag(answers);
  const band = tag ? HOURS_BANDS[tag] : null;
  const hours = band ? band.min : null;
  const insteadTag = instead(answers);
  const wantOrShould = wantOrShouldOf(answers);
  const showsGap = hours !== null && hours < GAP_LIMIT_HOURS;

  const lines: string[] = [];

  // Line 1: the thing, in their words.
  if (thing) lines.push(`You keep meaning to get to "${thing}".`);
  else if (rawThing) lines.push('You keep meaning to get to the thing you named.');
  else lines.push("You didn't name the thing you keep meaning to get to.");

  // Line 2: the hours, and where the rest went. Never invents a gap.
  if (band) {
    if (!showsGap) {
      lines.push(`Last week it got ${band.label}. That's real time.`);
    } else {
      const insteadPhrase = insteadTag ? INSTEAD_PHRASES[insteadTag] : null;
      lines.push(insteadPhrase ? `Last week it got ${band.label}. ${insteadPhrase} got most of the rest.` : `Last week it got ${band.label}.`);
    }
  }

  // Line 3: want or supposed to.
  if (wantOrShould === 'want') lines.push('You called it something you want.');
  else if (wantOrShould === 'should') lines.push("You called it something you think you're supposed to want.");
  else if (wantOrShould === 'unsure') lines.push("You're not sure yet whether it's something you want.");

  return {
    thing,
    hours,
    instead: insteadTag,
    wantOrShould,
    showsGap,
    line: lines.join('\n'),
  };
}

/** The mirror's lines, for UIs that render one per row. */
export function weekMirrorLines(mirror: WeekMirror): string[] {
  return mirror.line.split('\n');
}
