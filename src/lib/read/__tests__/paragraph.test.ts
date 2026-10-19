import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));
vi.mock('@/lib/ai/generate', () => ({
  generateText: vi.fn(),
}));

import { generateText } from '@/lib/ai/generate';
import {
  MIRROR_SYSTEM_PROMPT,
  PARAGRAPH_TIMEOUT_MS,
  buildUserMessage,
  extractQuotes,
  labelWordingLeaks,
  parseMirrorReply,
  quotablePhrases,
  requiredQuotes,
  staticMirrorParagraph,
  tappedLabels,
  verifyMirrorParagraph,
  writeMirrorParagraph,
} from '../paragraph';
import { optionLabel } from '../questions';
import { screenAnswers } from '../safety';
import type { ReadAnswers } from '../types';
import { ON_EMPTY_ANSWERS, SHOULDS_ANSWERS } from './fixtures';

const create = vi.mocked(generateText);
const reply = (content: string) => ({ text: content, finishReason: 'stop' }) as never;
/** The model's JSON reply, quoting whatever is in the paragraph between straight quotes. */
const replyFor = (paragraph: string, quotes: string[] = extractQuotes(paragraph)) => reply(JSON.stringify({ paragraph, quotes }));

const GOOD =
  'People come to you when they need someone to listen, and you show up for them. You described yourself as someone who "always says yes to my friends". The thing you keep meaning to get to is "the online course I started in spring". Last week it got one or two hours, and other people\'s asks took most of the rest. The sentence you say about yourself most weeks is "I\'ll sleep when it\'s done." Your answers describe a week that fills up with other people first, and your own plan waits for a quiet stretch that rarely comes.';

const quotable = Object.values(quotablePhrases(ON_EMPTY_ANSWERS));
const input = { answers: ON_EMPTY_ANSWERS, pattern: 'ON_EMPTY' as const, safety: screenAnswers(ON_EMPTY_ANSWERS) };

beforeEach(() => create.mockReset());

describe('verifyMirrorParagraph', () => {
  it('passes a paragraph with two verbatim quotes', () => {
    expect(verifyMirrorParagraph(GOOD, quotable)).toEqual({ ok: true, failures: [] });
  });

  it('fails when a quote is not in their answers', () => {
    const bad = GOOD.replace('"always says yes to my friends"', '"never says no to anyone"');
    const v = verifyMirrorParagraph(bad, quotable);
    expect(v.ok).toBe(false);
    expect(v.failures.join()).toContain('quote not in answers');
  });

  it('fails with fewer than two quotes', () => {
    const one = GOOD.replace(/"/g, '').replace('someone who always', 'someone who "always says yes to my friends" and always');
    expect(verifyMirrorParagraph(one, quotable).failures.join()).toContain('verified quotes 1 of 2');
  });

  it('accepts curly quotes and case differences', () => {
    const curly = GOOD.replace('"always says yes to my friends"', '“Always says yes to my friends”');
    expect(verifyMirrorParagraph(curly, quotable).ok).toBe(true);
  });

  it.each([
    ['woo', 'your energy'],
    ['chart', 'your chart'],
    ['clinical', 'your anxiety'],
    ['type label', 'a people pleaser'],
    ['voice ban', 'the reality is'],
  ])('fails on a banned word (%s)', (_, phrase) => {
    const bad = GOOD.replace('and your own plan waits', `and ${phrase} waits`);
    expect(verifyMirrorParagraph(bad, quotable).ok).toBe(false);
  });

  it('fails on a question, an em-dash, a short text and INSUFFICIENT', () => {
    expect(verifyMirrorParagraph(GOOD.replace('rarely comes.', 'rarely comes?'), quotable).ok).toBe(false);
    expect(verifyMirrorParagraph(GOOD.replace(', and other', ' — and other'), quotable).ok).toBe(false);
    expect(verifyMirrorParagraph('You said "always says yes to my friends" and "the online course I started in spring".', quotable).failures.join()).toContain(
      'length',
    );
    expect(verifyMirrorParagraph('INSUFFICIENT', quotable).ok).toBe(false);
  });
});

describe('writeMirrorParagraph', () => {
  it('returns the model text when it verifies', async () => {
    create.mockResolvedValueOnce(replyFor(GOOD));
    const r = await writeMirrorParagraph(input);
    expect(r).toEqual({ text: GOOD, usedFallback: false });
    const [params] = create.mock.calls[0] as unknown as [
      {
        system: string;
        messages: { role: string; content: string }[];
        openaiModel: string;
        json: { name: string; schema: { required: string[]; additionalProperties: boolean } };
        maxRetries: number;
      },
    ];
    expect(params.system).toBe(MIRROR_SYSTEM_PROMPT);
    expect((params as unknown as { tier: string }).tier).toBe('standard');
    expect(params.messages[0].role).toBe('user');
    expect(params.openaiModel).toBe(process.env.OPENAI_MODEL || 'gpt-4o');
    // Strict JSON schema -> Claude structured outputs.
    expect(params.json.name).toBe('mirror_paragraph');
    expect(params.json.schema.required).toEqual(['paragraph', 'quotes']);
    expect(params.json.schema.additionalProperties).toBe(false);
    expect(params.maxRetries).toBe(0);
  });

  it('retries once, then falls back when verification keeps failing', async () => {
    create.mockResolvedValue(replyFor(GOOD.replace('"always says yes to my friends"', '"made up words here"')));
    const r = await writeMirrorParagraph(input);
    expect(create).toHaveBeenCalledTimes(2);
    expect(r.usedFallback).toBe(true);
    expect(r.text).toBe(staticMirrorParagraph('ON_EMPTY', ON_EMPTY_ANSWERS));
  });

  it('falls back on an API error without retrying', async () => {
    create.mockRejectedValueOnce(new Error('500'));
    const r = await writeMirrorParagraph(input);
    expect(create).toHaveBeenCalledTimes(1);
    expect(r.usedFallback).toBe(true);
  });

  it('falls back on a timeout', async () => {
    // A valid reply that arrives after the budget: the paragraph must not wait for it.
    create.mockImplementation((() => new Promise((resolve) => setTimeout(() => resolve(replyFor(GOOD)), 300))) as never);
    const t0 = Date.now();
    const r = await writeMirrorParagraph(input, { timeoutMs: 50 });
    expect(r.usedFallback).toBe(true);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(PARAGRAPH_TIMEOUT_MS).toBe(12_000);
  });

  it('falls back without calling the model when there is no free text to quote', async () => {
    const none: ReadAnswers = { q7: { questionId: 'q7', parts: { hours: 'hours:0' } }, q1: { questionId: 'q1', choice: ['seg:operator'] } };
    const r = await writeMirrorParagraph({ answers: none, pattern: 'SHOULDS', safety: screenAnswers(none) });
    expect(create).not.toHaveBeenCalled();
    expect(r.usedFallback).toBe(true);
    expect(r.text).not.toContain('"');
  });

  it('asks for one quote, not two, when the free text is thin', async () => {
    const thin: ReadAnswers = { q7: { questionId: 'q7', parts: { thing: 'a podcast', hours: 'hours:0' } } };
    create.mockResolvedValueOnce(replyFor('You keep meaning to get to "a podcast".'));
    await writeMirrorParagraph({ answers: thin, pattern: 'SHOULDS', safety: screenAnswers(thin) });
    const [params] = create.mock.calls[0] as unknown as [{ messages: { content: string }[] }];
    expect(params.messages[0].content).toContain('Quotes required: exactly 1');
  });

  it('keeps the fallback when the reply is not the JSON shape', async () => {
    create.mockResolvedValue(reply(GOOD));
    const r = await writeMirrorParagraph(input);
    expect(create).toHaveBeenCalledTimes(2);
    expect(r.usedFallback).toBe(true);
  });

  it('never quotes clinical text, even though the model is called', async () => {
    const answers: ReadAnswers = {
      ...SHOULDS_ANSWERS,
      q9: { questionId: 'q9', text: "I've been depressed and I'll get to it after my diagnosis" },
    };
    create.mockResolvedValueOnce(replyFor(GOOD));
    await writeMirrorParagraph({ answers, pattern: 'SHOULDS', safety: screenAnswers(answers) });
    const [params] = create.mock.calls[0] as unknown as [{ messages: { content: string }[] }];
    expect(params.messages[0].content).not.toMatch(/depress|diagnos/i);
  });

  it('returns nothing for crisis and never calls the model', async () => {
    const r = await writeMirrorParagraph({ ...input, safety: { tier: 'crisis', matchedLists: ['crisis:suicide'] } });
    expect(r).toEqual({ text: '', usedFallback: true });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('what reaches the model', () => {
  it('never sends tier-2 text, and never quotes it in the fallback', () => {
    const answers: ReadAnswers = {
      ...ON_EMPTY_ANSWERS,
      q9: { questionId: 'q9', text: 'my trauma keeps me stuck' },
    };
    const q = quotablePhrases(answers);
    expect(Object.keys(q)).not.toContain('q9.text');
    const msg = buildUserMessage({ answers, pattern: 'ON_EMPTY', safety: screenAnswers(answers) }, q);
    expect(msg).not.toMatch(/trauma/i);
    expect(staticMirrorParagraph('ON_EMPTY', answers)).not.toMatch(/trauma/i);
  });

  it('sends their words and the tapped labels, never a chart', () => {
    const msg = buildUserMessage(input, quotablePhrases(ON_EMPTY_ANSWERS));
    expect(msg).toContain('always says yes to my friends');
    expect(msg).toContain("Other people's asks");
    expect(msg).not.toMatch(/chart|placement|human design/i);
  });

  it('builds a static fallback that describes and quotes safely', () => {
    const t = staticMirrorParagraph('ON_EMPTY', ON_EMPTY_ANSWERS);
    expect(t).toContain('You told us people come to you for a listening ear.');
    expect(t).toContain('"always says yes to my friends"');
    expect(t).toContain('last week it got 1–2 hours');
    expect(t).not.toContain('—');
  });
});

// The e2e failures: the model quoted option labels, which are not the person's words.
describe('option labels are never quoted or copied', () => {
  // Labels are stored with their own quote marks and full stop. The person sees the words only.
  const plain = (l: string | null) => (l ?? '').replace(/[".]/g, '').trim();
  const guilt = plain(optionLabel('say:no_guilt'));
  const others = plain(optionLabel('stall:others'));

  it('has the labels the e2e run quoted', () => {
    expect(guilt).toBe("I can't say no without feeling guilty");
    expect(others).toBe("Other people's stuff took the time first");
    expect(tappedLabels(ON_EMPTY_ANSWERS)).toEqual(expect.arrayContaining([optionLabel('say:no_guilt'), optionLabel('stall:others')]));
  });

  it('fails a quote of an option label', () => {
    const bad = GOOD.replace('"always says yes to my friends"', `"${guilt}"`);
    const v = verifyMirrorParagraph(bad, quotable, { required: 2, labels: tappedLabels(ON_EMPTY_ANSWERS) });
    expect(v.failures.join()).toContain(`quote not in answers: ${guilt.slice(0, 40)}`);
  });

  it('fails a label copied without quote marks', () => {
    const bad = GOOD.replace('Your answers describe a week that fills up with other people first', `Your answers say ${others.toLowerCase()} as well`);
    const v = verifyMirrorParagraph(bad, quotable, { required: 2, labels: tappedLabels(ON_EMPTY_ANSWERS) });
    expect(v.ok).toBe(false);
    expect(v.failures.join()).toContain('option label wording');
  });

  it('still allows a paraphrase of a label', () => {
    const para = GOOD.replace('Your answers describe a week that fills up with other people first', 'Your answers show a week where other people get first call on you');
    expect(verifyMirrorParagraph(para, quotable, { required: 2, labels: tappedLabels(ON_EMPTY_ANSWERS) }).ok).toBe(true);
  });

  it('ignores a run the person also typed', () => {
    const typed = ['I always say yes to my friends'];
    expect(labelWordingLeaks('You always say yes to my friends.', ['I always say yes to my friends'], typed)).toEqual([]);
    expect(labelWordingLeaks('You always say yes to my friends.', ['I always say yes to my friends'], [])).not.toEqual([]);
  });
});

describe('structured reply', () => {
  it('parses the JSON shape, with or without a code fence', () => {
    expect(parseMirrorReply('{"paragraph":"Hi.","quotes":["a b"]}')).toEqual({ paragraph: 'Hi.', quotes: ['a b'] });
    expect(parseMirrorReply('```json\n{"paragraph":"Hi.","quotes":[]}\n```')).toEqual({ paragraph: 'Hi.', quotes: [] });
  });

  it('rejects anything else', () => {
    expect(parseMirrorReply('You said "x y".')).toBeNull();
    expect(parseMirrorReply('{"paragraph":"Hi."}')).toBeNull();
    expect(parseMirrorReply('{"paragraph":"Hi.","quotes":[1]}')).toBeNull();
  });

  it('fails when a listed quote is not in the paragraph', () => {
    const v = verifyMirrorParagraph(GOOD, quotable, { listed: [...extractQuotes(GOOD), 'always says yes to my friends and more'] });
    expect(v.failures.join()).toContain('listed quote not in paragraph');
  });

  it('fails when the paragraph quotes something it did not list', () => {
    const v = verifyMirrorParagraph(GOOD, quotable, { listed: extractQuotes(GOOD).slice(1) });
    expect(v.failures.join()).toContain('unlisted quote');
  });

  it('passes when the listed quotes match the quoted spans', () => {
    expect(verifyMirrorParagraph(GOOD, quotable, { listed: extractQuotes(GOOD) }).ok).toBe(true);
  });
});

describe('how many quotes the free text allows', () => {
  it('asks for two when two answers are usable', () => {
    expect(requiredQuotes(quotablePhrases(ON_EMPTY_ANSWERS))).toBe(2);
  });

  it('asks for one when the only text is one short phrase', () => {
    expect(requiredQuotes({ 'q7.thing': 'a podcast' })).toBe(1);
  });

  it('asks for two from one answer with two clauses', () => {
    expect(requiredQuotes({ 'q9.text': "I'll get to it when things calm down. I keep saying so" })).toBe(2);
  });

  it('asks for none when there is no usable text', () => {
    expect(requiredQuotes({})).toBe(0);
  });

  it('accepts one quote when the free text allows only one', () => {
    const one = 'You told us people come to you for a listening ear. You keep meaning to get to "a podcast", and last week it got one or two hours. '
      + 'Other people took most of the rest of your week, and your own plan waits for a quiet stretch that rarely comes. The sentence you keep coming back to is simple: you wanted this to happen first. '
      + 'Your answers describe a week that fills up with other people, while the thing you care about waits at the back of the queue for a time that keeps moving.';
    expect(verifyMirrorParagraph(one, ['a podcast is my thing'], { required: 1 }).failures.filter((f) => f.startsWith('verified'))).toEqual([]);
    expect(verifyMirrorParagraph(one, ['a podcast is my thing'], { required: 2 }).failures.join()).toContain('verified quotes 1 of 2');
  });
});
