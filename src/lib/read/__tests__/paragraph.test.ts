import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));
vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));

import { openai } from '@/lib/openai/client';
import {
  MIRROR_SYSTEM_PROMPT,
  PARAGRAPH_TIMEOUT_MS,
  buildUserMessage,
  quotablePhrases,
  staticMirrorParagraph,
  verifyMirrorParagraph,
  writeMirrorParagraph,
} from '../paragraph';
import { screenAnswers } from '../safety';
import type { ReadAnswers } from '../types';
import { ON_EMPTY_ANSWERS } from './fixtures';

const create = vi.mocked(openai.chat.completions.create);
const reply = (content: string) => ({ choices: [{ message: { content } }] }) as never;

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
    create.mockResolvedValueOnce(reply(GOOD));
    const r = await writeMirrorParagraph(input);
    expect(r).toEqual({ text: GOOD, usedFallback: false });
    const [params] = create.mock.calls[0] as unknown as [{ messages: { role: string; content: string }[]; model: string }];
    expect(params.messages[0]).toEqual({ role: 'system', content: MIRROR_SYSTEM_PROMPT });
    expect(params.model).toBe(process.env.OPENAI_MODEL || 'gpt-4o');
  });

  it('retries once, then falls back when verification keeps failing', async () => {
    create.mockResolvedValue(reply(GOOD.replace('"always says yes to my friends"', '"made up words here"')));
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
    create.mockImplementation((() => new Promise((resolve) => setTimeout(() => resolve(reply(GOOD)), 300))) as never);
    const t0 = Date.now();
    const r = await writeMirrorParagraph(input, { timeoutMs: 50 });
    expect(r.usedFallback).toBe(true);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(PARAGRAPH_TIMEOUT_MS).toBe(12_000);
  });

  it('falls back without calling the model when there is too little to quote', async () => {
    const thin: ReadAnswers = { q7: { questionId: 'q7', parts: { thing: 'a podcast', hours: 'hours:0' } } };
    const r = await writeMirrorParagraph({ answers: thin, pattern: 'SHOULDS', safety: screenAnswers(thin) });
    expect(create).not.toHaveBeenCalled();
    expect(r.usedFallback).toBe(true);
    expect(r.text).toContain('"a podcast"');
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
