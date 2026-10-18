import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paragraph', () => ({
  writeMirrorParagraph: vi.fn(async () => ({ text: 'MOCK PARAGRAPH', usedFallback: false })),
}));

import { writeMirrorParagraph } from '../paragraph';
import { PRODUCTS } from '@/lib/constants/products';
import { buildWeekMirror } from '../mirror';
import { CRISIS_LINES, VERIFIED_ON, PATTERNS, buildPreview, buildResult, fillMove, patternDisplay } from '../results';
import { screenAnswers } from '../safety';
import { scorePerceptionRead } from '../score';
import type { ReadAnswers, ReadUtm, ResultBlock } from '../types';
import { NOT_CAUGHT_UP_ANSWERS, NO_THREAD_ANSWERS, ON_EMPTY_ANSWERS, SHOULDS_ANSWERS, SMALLER_ANSWERS } from './fixtures';

function run(answers: ReadAnswers, utm?: ReadUtm, writeParagraph?: Parameters<typeof buildResult>[1]['writeParagraph']) {
  return buildResult(
    { sessionId: 's1', answers, scores: scorePerceptionRead(answers), mirror: buildWeekMirror(answers), safety: screenAnswers(answers), utm },
    writeParagraph ? { writeParagraph } : {},
  );
}

const ids = (blocks: ResultBlock[]) => blocks.map((b) => (b.id === 'scope' ? `scope:${b.meta?.kind}` : b.id));
const block = (blocks: ResultBlock[], id: string) => blocks.find((b) => b.id === id)!;

beforeEach(() => vi.mocked(writeMirrorParagraph).mockClear());

describe('PATTERNS', () => {
  it('routes each pattern to the right LIVE scan (checked against products.ts)', () => {
    const routes = Object.fromEntries(Object.values(PATTERNS).map((p) => [p.id, p.scanSlug]));
    expect(routes).toEqual({
      SHOULDS: 'perception-rite-scan-2',
      NOT_CAUGHT_UP: 'perception-rite-scan-1',
      ON_EMPTY: 'perception-rite-scan-3',
      NO_THREAD: 'perception-rite-scan-5',
      SMALLER: 'perception-rite-scan-4',
    });
    for (const p of Object.values(PATTERNS)) expect(PRODUCTS[p.scanSlug as keyof typeof PRODUCTS]?.name).toBe(p.scanName);
    expect(PRODUCTS['perception-rite-bundle'].price).toBe(12);
  });

  it('keeps names, reads and on-camera lines inside the naming lengths (N4)', () => {
    for (const p of Object.values(PATTERNS)) {
      expect(p.name.split(' ').length).toBeLessThanOrEqual(6);
      expect(p.read.split(' ').length).toBeLessThanOrEqual(20);
      expect(p.onCamera.split(' ').length).toBeLessThanOrEqual(15);
    }
  });

  it('keeps banned words and em-dashes out of all static copy', () => {
    const copy = JSON.stringify(PATTERNS);
    expect(copy).not.toMatch(/quantum|frequency|vibration|archetype|10,000/i);
    expect(copy).not.toContain('—');
  });

  it('marks receipts the evidence map still flags VERIFY', () => {
    expect(PATTERNS.SHOULDS.receipts.every((r) => r.verify)).toBe(true);
    expect(PATTERNS.SHOULDS.receipts[0]).toMatchObject({ claim: 'P3/O2', tier: 'E1' });
  });
});

describe('buildResult block order', () => {
  it('assembles the standard order and calls the paragraph once', async () => {
    const r = await run(SHOULDS_ANSWERS);
    expect(ids(r.blocks)).toEqual([
      'mirror',
      'pattern',
      'their_words',
      'not_alone',
      'why_it_didnt_stick',
      'whats_going_on',
      'fix_fits',
      'permission',
      'move',
      'offer',
      'accuracy',
    ]);
    expect(writeMirrorParagraph).toHaveBeenCalledTimes(1);
    expect(block(r.blocks, 'their_words').body).toBe('MOCK PARAGRAPH');
    expect(r.pattern).toBe('SHOULDS');
    expect(r.patternName).toBe('Running on shoulds');
    expect(r.offer).toEqual({ productSlug: 'perception-rite-bundle', priceUsd: 12, scanSlug: 'perception-rite-scan-2', scanName: 'Value Pattern Decoder' });
    expect(r.usedFallback).toBe(false);
  });

  it('opens with the week mirror, then "You said" and the pattern', async () => {
    const r = await run(SHOULDS_ANSWERS);
    expect(r.blocks[0].body).toContain('"writing again"');
    expect(r.blocks[1].body).toContain('You said: "I\'m doing what I\'m supposed to');
    expect(r.blocks[1].title).toBe('Your pattern: Running on shoulds');
  });

  it('adds the burnout scope line for ON_EMPTY and the "nothing yet" variant of block 5', async () => {
    const r = await run(ON_EMPTY_ANSWERS);
    expect(ids(r.blocks)).toEqual([
      'mirror', 'pattern', 'their_words', 'not_alone', 'why_it_didnt_stick', 'whats_going_on', 'fix_fits', 'scope:pattern', 'permission', 'move', 'offer', 'accuracy',
    ]);
    expect(block(r.blocks, 'why_it_didnt_stick').title).toContain('What usually gets tried');
  });

  it('fills the move slots with their words', async () => {
    const r = await run(SHOULDS_ANSWERS);
    expect(block(r.blocks, 'move').body).toContain('Take "writing again".');
    expect(block(r.blocks, 'move').body).toContain("Don't add anything else this week. No new app, book or video. Just this.");
    expect(fillMove('NOT_CAUGHT_UP', NOT_CAUGHT_UP_ANSWERS)).toContain('the sentence "I\'m not good enough yet" says');
  });
});

describe('content selection', () => {
  it('picks the highest Q11 line in the spec order, then the outcome line', async () => {
    const r = await run(NOT_CAUGHT_UP_ANSWERS); // affirm + willpower, out:worse
    const why = block(r.blocks, 'why_it_didnt_stick');
    expect(why.meta).toMatchObject({ triedTag: 'tried:affirm', outcomeTag: 'out:worse' });
    expect(why.body).toContain('Wood et al., 2009');
    expect(why.source?.tier).toBe('E2');
  });

  it('frames the move for people who tried manifesting methods', async () => {
    const r = await run(NOT_CAUGHT_UP_ANSWERS);
    expect(block(r.blocks, 'move').body).toContain('two minutes a night');
  });

  it('uses the manifestation name for NOT_CAUGHT_UP and says self-concept for picture', async () => {
    const r = await run(NOT_CAUGHT_UP_ANSWERS, { variant: 'manifestation' });
    expect(r.patternName).toBe('The old self-concept keeps winning');
    expect(block(r.blocks, 'whats_going_on').body).toContain('The self-concept you run on filters it out');
    expect(block(r.blocks, 'pattern').body).toContain('You said: "I keep affirming it');
    expect((await run(NOT_CAUGHT_UP_ANSWERS, { content: 'method' })).patternName).toBe('The old self-concept keeps winning');
  });

  it('adds the operator lines on pricing paths only', async () => {
    const op = await run(SMALLER_ANSWERS);
    expect(block(op.blocks, 'whats_going_on').body).toContain('Rao & Monroe');
    expect(block(op.blocks, 'pattern').body).toContain('or charge for it');
    const lead = { ...SMALLER_ANSWERS, q1: { questionId: 'q1', choice: ['seg:team_lead'] } };
    const r = await run(lead);
    expect(block(r.blocks, 'whats_going_on').body).not.toContain('Rao & Monroe');
    expect(block(r.blocks, 'pattern').body).not.toContain('charge');
    expect(block(r.blocks, 'offer').body).not.toContain('or charge for it');
    expect(patternDisplay('SMALLER', { segment: null, variant: null, source: null }).read).not.toContain('charge');
    const nt = await run(NO_THREAD_ANSWERS);
    expect(block(nt.blocks, 'whats_going_on').body).toContain('The thread is also your positioning');
  });

  it('swaps "video" for "course" on YouTube traffic', async () => {
    const r = await run(SHOULDS_ANSWERS, { source: 'youtube' });
    expect(block(r.blocks, 'move').body).toContain('No new app, book or course.');
  });

  it('shows the behind line for SHOULDS when Q2 g was picked', async () => {
    const a = { ...SHOULDS_ANSWERS, q2: { questionId: 'q2', choice: ['say:shoulds', 'say:behind'], parts: { loudest: 'say:shoulds' } } };
    expect(block((await run(a)).blocks, 'whats_going_on').body).toContain("'Behind' needs a schedule");
  });

  it('marks VERIFY receipts and carries the lineage and solution check', async () => {
    const r = await run(SHOULDS_ANSWERS);
    const w = block(r.blocks, 'whats_going_on');
    expect(w.meta?.verify).toBe(true);
    expect(w.meta?.solutionCheck).toBeDefined();
    expect((w.meta?.lineage as { sources: unknown[] }).sources).toHaveLength(4);
  });

  it('never puts chart, score or quantum words on the page', async () => {
    for (const a of [SHOULDS_ANSWERS, NOT_CAUGHT_UP_ANSWERS, ON_EMPTY_ANSWERS, NO_THREAD_ANSWERS, SMALLER_ANSWERS]) {
      const r = await run(a);
      const text = r.blocks.map((b) => `${b.title ?? ''} ${b.body}`).join(' ');
      expect(text).not.toMatch(/quantum|percent|%|score|archetype|—/i);
    }
  });
});

describe('safety paths', () => {
  it('crisis: one support block, no pattern, no offer, no AI call', async () => {
    const answers = { ...SHOULDS_ANSWERS, q9: { questionId: 'q9', text: 'I want to die' } };
    const r = await run(answers);
    expect(ids(r.blocks)).toEqual(['support']);
    expect(r.pattern).toBeNull();
    expect(r.patternName).toBeNull();
    expect(r.offer).toBeNull();
    expect(writeMirrorParagraph).not.toHaveBeenCalled();
    const s = r.blocks[0];
    for (const l of Object.values(CRISIS_LINES)) expect(s.body).toContain(l.line);
    expect(s.body).toContain('call or text 988');
    expect(s.body).toContain('text HOME to 741741');
    expect(s.body).toContain('116 123');
    expect(s.body).toContain('9-8-8');
    expect(s.body).toContain('13 11 14');
    expect(s.body).toContain('findahelpline.com');
    expect(s.body).toContain('local emergency number');
    expect(s.meta?.linesVerified).toBe(true);
    expect(s.meta?.verifiedOn).toBe(VERIFIED_ON);
    // Safe-messaging guidance: no method words, no "committed", no blame or labels.
    expect(s.body).not.toMatch(/committed|method|overdose|pills|successful|failed|weak|selfish/i);
    expect(s.body).not.toMatch(/VERIFY|\{\{/);
    expect(s.meta?.showAnswersLabel).toBe('Show me my answers anyway');
    expect(JSON.stringify(s)).not.toContain('Get Rite I');
  });

  it('crisis preview has no mirror and no pattern', () => {
    const answers = { ...SHOULDS_ANSWERS, q9: { questionId: 'q9', text: 'I want to die' } };
    const p = buildPreview({ sessionId: 's', answers, scores: scorePerceptionRead(answers), mirror: buildWeekMirror(answers), safety: screenAnswers(answers) });
    expect(p.mirror).toBeNull();
    expect(p.pattern).toBeNull();
  });

  it('clinical: scope line above the mirror paragraph, offer stays', async () => {
    const answers = { ...SHOULDS_ANSWERS, q9: { questionId: 'q9', text: 'my depression makes it hard' } };
    const r = await run(answers);
    expect(ids(r.blocks).slice(0, 4)).toEqual(['mirror', 'pattern', 'scope:clinical', 'their_words']);
    expect(block(r.blocks, 'scope').body).toContain("can't assess or treat depression");
    expect(r.offer).not.toBeNull();
  });

  it('hardship: the real-limits line above the move', async () => {
    const answers = { ...SHOULDS_ANSWERS, q9: { questionId: 'q9', text: 'I got laid off and I am broke' } };
    const r = await run(answers);
    const order = ids(r.blocks);
    expect(order.indexOf('scope:hardship')).toBe(order.indexOf('move') - 1);
    expect(r.blocks.find((b) => b.meta?.kind === 'hardship')?.body).toContain("That isn't a mindset problem");
  });

  it('preview for a normal read carries the mirror and the pattern', () => {
    const p = buildPreview({
      sessionId: 's',
      answers: ON_EMPTY_ANSWERS,
      scores: scorePerceptionRead(ON_EMPTY_ANSWERS),
      mirror: buildWeekMirror(ON_EMPTY_ANSWERS),
      safety: screenAnswers(ON_EMPTY_ANSWERS),
    });
    expect(p.pattern).toEqual({ id: 'ON_EMPTY', name: 'Yes to everyone but you', read: PATTERNS.ON_EMPTY.read });
    expect(p.mirror?.showsGap).toBe(true);
  });
});

describe('fallback path', () => {
  it('passes usedFallback through from the paragraph', async () => {
    const writer = vi.fn(async () => ({ text: 'static', usedFallback: true }));
    const r = await run(SHOULDS_ANSWERS, undefined, writer);
    expect(r.usedFallback).toBe(true);
    expect(block(r.blocks, 'their_words').meta?.usedFallback).toBe(true);
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({ pattern: 'SHOULDS' }));
  });
});
