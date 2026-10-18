import { describe, it, expect } from 'vitest';
import { renderReadResultEmail, type ReadResultEmailData } from '../read-result';
import { renderReadDay2Email, DAY2_SUBJECTS } from '../read-day2';
import { renderReadDay7Email, DAY7_SUBJECT } from '../read-day7';
import { toPlain, READ_PATTERN_COPY, type RenderedReadEmail } from '../read-shared';
import type { PatternId } from '@/lib/read/types';

const RESULT_URL = 'https://app.example.test/read/result/abc?t=signed';
const UNSUB = 'https://app.example.test/read/email/unsubscribe/?t=unsub';
const CHECKOUT = 'https://app.example.test/read/checkout/?session=abc';

const r1Base: ReadResultEmailData = {
  pattern: 'SHOULDS',
  patternName: 'Running on shoulds',
  patternRead: null,
  mirrorLines: [
    'You keep meaning to get to "writing again".',
    'Last week it got 0 hours. Things you thought you should do got most of the rest.',
  ],
  move: 'Take "writing again". Finish this line: "I should do this because…".',
  watch: 'Which feels lighter by Sunday.',
  resultUrl: RESULT_URL,
  offer: { scanName: 'Value Pattern Decoder', priceUsd: 12, checkoutUrl: CHECKOUT },
  consentMarketing: true,
  unsubscribeUrl: UNSUB,
  replyEmail: 'austin@example.test',
};

/** tonality.md: no em-dashes, no exclamation marks, no "quantum", no hype words. */
function expectVoice(e: RenderedReadEmail) {
  for (const s of [e.subject, e.preheader, e.text]) {
    expect(s).not.toMatch(/—/);
    expect(s).not.toMatch(/!/);
    // The brand sits in the sign-off and footer only (spec v3 §3.6); no other "quantum".
    expect(s.toLowerCase().replace(/quantum strategies/g, '')).not.toContain('quantum');
    expect(s.toLowerCase()).not.toMatch(/unlock your|game-changer|journey|transform|empower/);
  }
  expect(e.html).toContain('<!DOCTYPE html>');
}

describe('R1 result email', () => {
  it('opens with the week mirror, names the pattern and its read, and links back to the full Read with UTMs', () => {
    const e = renderReadResultEmail(r1Base);
    expect(e.subject).toBe('Your Perception Read: Running on shoulds');
    expect(e.preheader).toBe('You keep meaning to get to "writing again".');
    expect(e.text.indexOf('YOUR WEEK')).toBeLessThan(e.text.indexOf('Your pattern: Running on shoulds.'));
    expect(e.text).toContain(READ_PATTERN_COPY.SHOULDS.read);
    expect(e.text).toContain('YOUR ONE MOVE THIS WEEK');
    expect(e.text).toContain('What to watch: Which feels lighter by Sunday.');
    expect(e.text).toContain('utm_source=email');
    expect(e.text).toContain('utm_campaign=perception-read-r1');
    expect(e.text).toContain('utm_content=open_button');
    expect(e.html).toContain('Open your full Read');
    expect(e.html).toContain('&quot;writing again&quot;');
    expectVoice(e);
  });

  it('shows the $12 Rite I offer as a secondary block linking to the checkout bridge', () => {
    const e = renderReadResultEmail(r1Base);
    expect(e.text).toContain('Rite I, $12');
    expect(e.text).toContain('Get Rite I, start with Value Pattern Decoder');
    expect(e.text).toContain('read/checkout/?session=abc');
    expect(e.text).toContain('utm_content=offer_rite1');
    expect(e.html.indexOf('Open your full Read')).toBeLessThan(e.html.indexOf('Rite I, $12'));
  });

  it('hides the offer when there is none', () => {
    const e = renderReadResultEmail({ ...r1Base, offer: null });
    expect(e.text).not.toContain('Rite I');
    expect(e.html).not.toContain('class="offer"');
  });

  it('with marketing consent: promises day 2 and day 7, one-click unsubscribe', () => {
    const e = renderReadResultEmail(r1Base);
    expect(e.text).toContain("I'll check in about your move on day 2 and day 7.");
    expect(e.text).toContain(`Unsubscribe in one click: ${UNSUB}`);
    expect(e.html).toContain(UNSUB.replace(/&/g, '&amp;'));
  });

  it('without marketing consent: says it is the only email, still has an unsubscribe link', () => {
    const e = renderReadResultEmail({ ...r1Base, consentMarketing: false });
    expect(e.text).toContain("It's the only email we'll send you about it.");
    expect(e.text).not.toContain('day 2 and day 7');
    expect(e.text).toContain(`Don't email me again: ${UNSUB}`);
    expectVoice(e);
  });

  it('falls back to a link when the move is missing, and to canonical copy when names are missing', () => {
    const e = renderReadResultEmail({ ...r1Base, pattern: 'ON_EMPTY', patternName: null, move: null, watch: null, mirrorLines: [] });
    expect(e.subject).toBe('Your Perception Read: Yes to everyone but you');
    expect(e.text).not.toContain('YOUR WEEK');
    expect(e.text).toContain("It's at the bottom of your Read");
    expect(e.preheader).toBe(READ_PATTERN_COPY.ON_EMPTY.read);
  });

  it('escapes HTML in their own words', () => {
    const e = renderReadResultEmail({ ...r1Base, mirrorLines: ['You keep meaning to get to "<script>x</script>".'] });
    expect(e.html).not.toContain('<script>x</script>');
    expect(e.html).toContain('&lt;script&gt;');
  });
});

describe('Day 2 email', () => {
  const base = { pattern: 'ON_EMPTY' as PatternId, move: 'Say "Let me check and come back to you" before you answer.', resultUrl: RESULT_URL, unsubscribeUrl: UNSUB };

  it('asks for a one-line reply about the move, with a pattern subject', () => {
    const e = renderReadDay2Email(base);
    expect(e.subject).toBe("How's the count going?");
    expect(e.text).toContain('Two days ago your Perception Read gave you one thing to try this week:');
    expect(e.text).toContain(base.move);
    expect(e.text).toContain('Hit reply and tell me in one line.');
    expect(e.text).toContain(`Unsubscribe in one click: ${UNSUB}`);
    expect(e.text).toContain('utm_campaign=perception-read-day2');
    expectVoice(e);
  });

  it('has a subject for every pattern and works without the move text', () => {
    for (const p of Object.keys(READ_PATTERN_COPY) as PatternId[]) {
      const e = renderReadDay2Email({ ...base, pattern: p, move: null });
      expect(e.subject).toBe(DAY2_SUBJECTS[p]);
      expect(e.text).toContain(READ_PATTERN_COPY[p].name);
      expectVoice(e);
    }
  });
});

describe('Day 7 email', () => {
  const answerUrl = (q: string, v: string) => `https://app.example.test/read/email/answer?t=${q}.${v}`;
  const base = { pattern: 'SHOULDS' as PatternId, baseline: 4, resultUrl: RESULT_URL, unsubscribeUrl: UNSUB, answerUrl };

  it('asks the PMF question with four one-click answers', () => {
    const e = renderReadDay7Email(base);
    expect(e.subject).toBe(DAY7_SUBJECT);
    expect(e.text).toContain("If you couldn't get the full Rite I, how would you feel?");
    for (const v of ['very', 'somewhat', 'not', 'have_it']) expect(e.text).toContain(`t=pmf.${v}`);
    expect(e.text).toContain('Very disappointed');
    expect(e.text).toContain("I've already got it");
    expectVoice(e);
  });

  it('re-rates the Q10 baseline with the same anchors and shows their day-one number', () => {
    const e = renderReadDay7Email(base);
    expect(e.text).toContain('When you took the Read, you said 4 out of 10.');
    expect(e.text).toContain('1 = almost none of it · 5 = about half · 10 = all of it');
    for (let i = 1; i <= 10; i++) expect(e.text).toContain(`t=rerate.${i}`);
    const noBaseline = renderReadDay7Email({ ...base, baseline: null });
    expect(noBaseline.text).toContain('Same scale as the Read, for this past week:');
  });

  it('asks whether they did the move, and tags every answer link with UTMs', () => {
    const e = renderReadDay7Email(base);
    expect(e.text).toContain('Did you do the move at least once?');
    for (const v of ['yes', 'started_stopped', 'no']) expect(e.text).toContain(`t=move.${v}`);
    expect(e.text).toContain('utm_content=pmf_very');
    expect(e.html).toContain('class="chip"');
  });
});

describe('toPlain', () => {
  it('strips light markdown and em-dashes', () => {
    expect(toPlain('**Bold** and _soft_ — [link](https://x.test)')).toBe('Bold and soft, link');
  });
});
