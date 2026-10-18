import { describe, expect, it } from 'vitest';
import { SAFETY_LISTS, normaliseForScreen, safetyListSizes, screenAnswers, screenFields, screenText, worstTier } from '../safety';

const CRISIS = [
  'I want to kill myself',
  'sometimes I think about suicide',
  'Been having suicidal thoughts',
  'suicdal most nights', // misspelling
  'i want to kms',
  "I don't want to be alive anymore",
  'I dont want to live like this',
  'I just want to die',
  'I wish I was dead',
  'everyone would be better off without me',
  "I'm going to end it all",
  'thinking about ending my life',
  'Self-harm again last week',
  "I've been cutting myself",
  'I hurt myself when it gets bad',
  'I took an overdose last year',
  'there is no reason to live',
  "I can't go on like this",
  'I want to unalive myself',
  'I WANT TO DIE!!!',
  'want to just die',
  'I wish I had never been born',
  "I don't want to be here anymore",
  'there is no point in going on',
  'my brother died by suicide',
  'I attempted suicide two years ago',
  "I'm ready to die",
];

const CLINICAL = [
  "I've been depressed since March",
  'my depression makes mornings hard',
  'I feel hopeless about work',
  'I feel numb most days',
  'I have an anxiety disorder',
  'I get panic attacks before calls',
  'there is a lot of trauma in my family',
  'my PTSD flares up',
  'I was diagnosed with ADHD last year',
  'I have bipolar',
  'I had an eating disorder',
  'my ex was abusive',
];

const HARDSHIP = [
  "I'm broke until payday",
  'I got laid off in May',
  'I lost my job',
  "we can't pay rent this month",
  'we were evicted',
  'my dad passed away in spring',
  'I lost my mum last year',
  'still grieving',
];

/** Ordinary answers with trap words (spec v3 §6). None of these is crisis. */
const TRAPS = [
  'I kill it at work',
  'this deadline is killing me',
  "I'm dying to start my podcast",
  'I could die of embarrassment',
  'my startup idea is dead in the water',
  'I broke my promise to myself',
  'I broke the record at the gym',
  'I want to diet properly',
  'I cut my hours at the shop',
  'I hurt my back lifting',
  'killer workout every morning',
  'I am done with excuses',
  "I'm dying to get this done",
  'killing it this quarter',
  'this commute kills me',
  'I nearly died laughing',
  'end of the line for that side project',
  'I want to end the meeting early',
  'I hate my job',
  'executing on the plan',
  'shooting a video',
];

describe('screenText tiers', () => {
  it.each(CRISIS)('crisis: %s', (t) => expect(screenText(t).tier).toBe('crisis'));
  it.each(CLINICAL)('clinical: %s', (t) => expect(screenText(t).tier).toBe('clinical'));
  it.each(HARDSHIP)('hardship: %s', (t) => expect(screenText(t).tier).toBe('hardship'));
  it.each(TRAPS)('not crisis: %s', (t) => expect(screenText(t).tier).not.toBe('crisis'));

  it('leaves most trap words at none', () => {
    const none = TRAPS.filter((t) => screenText(t).tier === 'none');
    expect(none.length).toBe(TRAPS.length);
  });

  it('returns none for empty text', () => {
    expect(screenText('')).toEqual({ tier: 'none', matchedLists: [] });
    expect(screenText(undefined)).toEqual({ tier: 'none', matchedLists: [] });
  });

  it('names the sub-lists that matched', () => {
    expect(screenText('I was diagnosed with ADHD').matchedLists).toEqual(['clinical:adhd', 'clinical:other']);
    expect(screenText('my depression').matchedLists).toEqual(['clinical:depression']);
  });

  it('lets the worst tier win', () => {
    expect(screenText("I'm broke and depressed").tier).toBe('clinical');
    expect(screenText("I'm broke, depressed and I want to die").tier).toBe('crisis');
    expect(worstTier('hardship', 'none', 'clinical')).toBe('clinical');
  });

  it('never returns the text', () => {
    const text = 'I want to kill myself after the launch';
    const r = screenText(text);
    expect(JSON.stringify(r)).not.toContain('launch');
    expect(Object.keys(r).sort()).toEqual(['matchedLists', 'tier']);
  });
});

describe('normaliseForScreen', () => {
  it('lowercases, drops apostrophes and punctuation, fixes misspellings', () => {
    expect(normaliseForScreen('I DON’T want to be ALIVE!!!')).toBe('i dont want to be alive');
    expect(normaliseForScreen('Self-harm')).toBe('self harm');
    expect(normaliseForScreen('sucide')).toBe('suicide');
  });
});

describe('screenAnswers', () => {
  it('screens Q2 other, Q6 skill, Q7 thing, Q8 lines and Q9, worst tier wins', () => {
    const answers = {
      q2: { questionId: 'q2', choice: ['say:other'], text: 'I lost my job' },
      q6: { questionId: 'q6', choice: ['come:skill'], text: 'listening' },
      q7: { questionId: 'q7', parts: { thing: 'my novel', hours: 'hours:0', wantOrShould: 'own:want' } },
      q8: { questionId: 'q8', parts: { line1: 'feels numb', line2: 'cooks', line3: 'runs' } },
      q9: { questionId: 'q9', text: 'whatever' },
    };
    const r = screenAnswers(answers);
    expect(r.tier).toBe('clinical');
    expect(r.matchedLists.sort()).toEqual(['clinical:depression', 'hardship:work']);
    const fields = screenFields(answers);
    expect(fields['q8.line1'].tier).toBe('clinical');
    expect(fields['q2.text'].tier).toBe('hardship');
    // Option tags are never screened as text.
    expect(Object.keys(fields)).not.toContain('q7.hours');
  });

  it('finds crisis text in any part', () => {
    expect(screenAnswers({ q8: { questionId: 'q8', parts: { line3: 'wants to end my life' } } }).tier).toBe('crisis');
    expect(screenAnswers({}).tier).toBe('none');
  });
});

describe('lists', () => {
  it('are marked for review and sized', () => {
    const sizes = safetyListSizes();
    expect(Object.keys(sizes)).toEqual(SAFETY_LISTS.map((l) => l.id));
    expect(sizes['crisis:suicide']).toBeGreaterThan(20);
  });
});
