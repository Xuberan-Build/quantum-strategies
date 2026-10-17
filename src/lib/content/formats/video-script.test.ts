import { describe, it, expect } from 'vitest';
import {
  validateVideoScript,
  renderVideoScript,
  countWords,
  type VideoScriptInput,
  type VideoScriptRules,
} from './video-script';
import { generateValidatedVideoScript, extractJson } from './video-script-generate';

// Synthetic rules: placeholder vocabulary, not a real brand voice pack.
const rules: VideoScriptRules = {
  bannedTerms: ['game-changer', 'unlock', "here's the truth"],
  handleWithCare: [{ term: 'energy', condition: 'physical or mental energy only' }],
  ctaSpamPatterns: ['changed my life', 'this one quiz'],
  outcomeTimeboxPatterns: ['/\\b(transform|rewire)\\b[^.?!]{0,40}\\bin\\s+\\d+\\s+days\\b/', 'overnight'],
  ctaMentionPatterns: ['/\\btake the (free )?(\\w+ )?quiz\\b/', 'link below'],
};

const words = (n: number, seed = 'word') => Array.from({ length: n }, (_, i) => `${seed}${i % 7}`).join(' ');
const cues = { onScreenText: ['Card'], bRoll: ['Desk shot'] };

/** A long-form script that passes: ~10 minutes at 150 wpm. */
function longScript(): VideoScriptInput {
  return {
    variant: 'long',
    title: 'Why the habit tracker keeps failing you',
    hook: { spoken: 'You have restarted the same habit five times this year and it keeps sliding back.', ...cues },
    lazyVersion: { name: 'Track harder', spoken: `The usual advice says track harder. ${words(60, 'lazy')}`, ...cues },
    credibility: { spoken: words(120, 'cred'), ...cues },
    mechanism: {
      name: 'The set point',
      claim: 'Behaviour returns to the picture you hold of yourself.',
      spoken: words(220, 'mech'),
      source: { citation: 'Author (1960) · Some Book', tier: 'model' },
      ...cues,
    },
    moves: [1, 2, 3].map((n) => ({
      name: `Move name ${n}`,
      explanation: words(260, `m${n}x`),
      exercise: `Write down three sentences you said today and circle one, for ${n} minutes, right now.`,
      ...cues,
    })),
    receipts: [
      { claim: 'A measured effect in a sample.', citation: 'Researcher et al. (2010) · Journal', tier: 'supported', onScreen: 'Receipt · Researcher (2010)' },
    ],
    caveat: { spoken: words(60, 'cav'), ...cues },
    synthesis: { spoken: 'Fix the setting, not the symptom.', ...cues },
    cta: {
      kind: 'quiz',
      spoken: 'The free quiz takes about five minutes, reads your answers for the pattern they repeat, and asks only for your email.',
      ...cues,
    },
    tags: { rite: 'rite-a', pillar: 'pillar-b', domain: 'Domain C' },
  };
}

/** A short that passes: ~50 seconds at 165 wpm. */
function shortScript(): VideoScriptInput {
  return {
    variant: 'short',
    title: 'Your tracker is not the problem',
    hook: { spoken: 'You keep restarting the same habit.', ...cues },
    lazyVersion: { name: 'Track harder', spoken: 'Everyone says track harder.', ...cues },
    mechanism: {
      name: 'The set point',
      claim: 'Behaviour returns to the self-picture.',
      spoken: 'Behaviour snaps back to the picture you hold of yourself.',
      source: { citation: 'Author (1960) · Some Book', tier: 'model' },
      ...cues,
    },
    moves: [1, 2, 3].map((n) => ({
      name: `Move ${n}`,
      explanation: 'Notice the sentence you use about yourself.',
      exercise: 'Say it out loud now and count one word that sounds old.',
      ...cues,
    })),
    receipts: [{ claim: 'x', citation: 'Author (1960)', tier: 'model', onScreen: 'Receipt · Author (1960)' }],
    cta: { kind: 'quiz', spoken: 'The free quiz shows you the pattern. Link below.', ...cues },
    tags: { rite: 'rite-a', pillar: 'pillar-b', domain: 'Domain C' },
  };
}

describe('validateVideoScript: passing scripts', () => {
  it('passes a well-formed long-form script', () => {
    const v = validateVideoScript(longScript(), rules);
    expect(v.errors).toEqual([]);
    expect(v.pass).toBe(true);
    expect(v.timing.totalSeconds).toBeGreaterThanOrEqual(480);
    expect(v.timing.totalSeconds).toBeLessThanOrEqual(840);
    expect(v.score).toBeGreaterThanOrEqual(8);
  });

  it('passes a well-formed short', () => {
    const v = validateVideoScript(shortScript(), rules);
    expect(v.errors).toEqual([]);
    expect(v.pass).toBe(true);
    expect(v.timing.totalSeconds).toBeLessThanOrEqual(60);
  });

  it('unwraps a single-element CTA array (model output)', () => {
    const s = longScript() as unknown as Record<string, unknown>;
    const v = validateVideoScript({ ...s, cta: [s.cta] }, rules);
    expect(v.pass).toBe(true);
  });

  it('renders a readable shooting script', () => {
    const v = validateVideoScript(longScript(), rules);
    const md = renderVideoScript(v.script!, v);
    expect(md).toContain('## Move 2: Move name 2');
    expect(md).toContain('**Exercise:**');
    expect(md).toContain('## Sources');
  });
});

describe('validateVideoScript: structural failures', () => {
  it('fails when a move has no exercise', () => {
    const s = longScript();
    s.moves[1] = { ...s.moves[1], exercise: '' };
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(false);
    expect(v.errors.map((e) => e.code)).toContain('move_no_exercise');
    expect(v.errors.find((e) => e.code === 'move_no_exercise')?.path).toBe('moves[1].exercise');
  });

  it('fails when there are not exactly 3 moves', () => {
    const s = longScript();
    s.moves = s.moves.slice(0, 2);
    const v = validateVideoScript(s, rules);
    expect(v.errors.map((e) => e.code)).toContain('move_count');
  });

  it('fails an unsourced mechanism', () => {
    const s = longScript();
    delete s.mechanism.source;
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(false);
    expect(v.errors.map((e) => e.code)).toContain('mechanism_unsourced');
  });

  it('fails a mechanism sourced to internal material', () => {
    const s = longScript();
    s.mechanism.source = { citation: 'Our own whitepaper', tier: 'internal' };
    const v = validateVideoScript(s, rules);
    expect(v.errors.map((e) => e.code)).toContain('mechanism_internal_source');
  });

  it('fails a contested receipt used as support, allows it as a debunk', () => {
    const s = longScript();
    s.receipts = [{ claim: 'Willpower runs out', citation: 'Old study (1998)', tier: 'contested', role: 'supports', onScreen: 'x' }];
    expect(validateVideoScript(s, rules).errors.map((e) => e.code)).toContain('receipt_contested_support');
    s.receipts[0].role = 'debunks';
    expect(validateVideoScript(s, rules).pass).toBe(true);
  });

  it('warns on citations marked VERIFY', () => {
    const s = longScript();
    s.mechanism.source = { citation: 'Author (1960) · Some Book — VERIFY', tier: 'model' };
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(true);
    expect(v.warnings.map((w) => w.code)).toContain('citation_unverified');
  });
});

describe('validateVideoScript: CTA rules', () => {
  it('fails two CTAs given as an array', () => {
    const s = longScript() as unknown as Record<string, unknown>;
    const v = validateVideoScript({ ...s, cta: [s.cta, s.cta] }, rules);
    expect(v.pass).toBe(false);
    expect(v.errors.map((e) => e.code)).toContain('cta_count');
    // The rest of the script is still validated and timed.
    expect(v.timing.totalSeconds).toBeGreaterThan(0);
  });

  it('fails a second CTA hidden in a move', () => {
    const s = longScript();
    s.moves[2] = { ...s.moves[2], explanation: `${s.moves[2].explanation} Before you go further, take the free pattern quiz.` };
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(false);
    expect(v.errors.find((e) => e.code === 'cta_second')?.path).toBe('moves[2].explanation');
  });

  it('fails a missing CTA', () => {
    const s = longScript() as unknown as Record<string, unknown>;
    delete s.cta;
    const v = validateVideoScript(s, rules);
    expect(v.errors.map((e) => e.code)).toContain('cta_missing');
  });

  it('fails spam-pattern CTA copy', () => {
    const s = longScript();
    s.cta.spoken = 'Honestly, this one quiz changed my life.';
    const v = validateVideoScript(s, rules);
    expect(v.errors.filter((e) => e.code === 'cta_spam_pattern')).toHaveLength(2);
  });
});

describe('validateVideoScript: language rules (injected)', () => {
  it('fails a banned term', () => {
    const s = longScript();
    s.mechanism.spoken = `${s.mechanism.spoken} This is how you unlock it.`;
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(false);
    expect(v.errors.find((e) => e.code === 'banned_term')?.path).toBe('mechanism.spoken');
  });

  it('matches banned terms case-insensitively with curly apostrophes', () => {
    const s = longScript();
    s.hook.spoken = 'Here’s The Truth about your habits.';
    expect(validateVideoScript(s, rules).errors.map((e) => e.code)).toContain('banned_term');
  });

  it('does not match a banned term inside a longer word', () => {
    const s = longScript();
    s.mechanism.spoken = `${s.mechanism.spoken} The door stays unlocked.`;
    expect(validateVideoScript(s, rules).errors.map((e) => e.code)).not.toContain('banned_term');
  });

  it('only warns when a banned term is the debunk target in the lazy-version beat', () => {
    const s = longScript();
    s.lazyVersion.spoken = 'They told you a morning routine would unlock everything.';
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(true);
    expect(v.warnings.map((w) => w.code)).toContain('banned_term_debunk_target');
  });

  it('fails outcome-timebox wording, including in the title', () => {
    const s = longScript();
    s.title = 'Rewire your habits in 30 days';
    s.moves[0] = { ...s.moves[0], explanation: `${s.moves[0].explanation} Results arrive overnight.` };
    const v = validateVideoScript(s, rules);
    const hits = v.errors.filter((e) => e.code === 'outcome_timebox').map((e) => e.path);
    expect(hits).toContain('title');
    expect(hits).toContain('moves[0].explanation');
  });

  it('only warns when an outcome-speed myth is named as the debunk target', () => {
    const s = longScript();
    s.lazyVersion.name = 'Rewire your habits in 21 days';
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(true);
    expect(v.warnings.map((w) => w.code)).toContain('outcome_timebox_debunk_target');
  });

  it('allows timeboxing the practice', () => {
    const s = longScript();
    s.title = 'Catch your words for 24 hours';
    expect(validateVideoScript(s, rules).errors.map((e) => e.code)).not.toContain('outcome_timebox');
  });

  it('warns on handle-with-care terms', () => {
    const s = longScript();
    s.credibility!.spoken = `${s.credibility!.spoken} I had no energy left.`;
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(true);
    expect(v.warnings.find((w) => w.code === 'handle_with_care')?.message).toContain('physical or mental energy only');
  });

  it('accepts voice-pack shaped rules ({ term, rule } care entries, /regex/ and literal patterns)', () => {
    const s = longScript();
    s.credibility!.spoken = `${s.credibility!.spoken} I had no energy left. It worked in seconds.`;
    const v = validateVideoScript(s, {
      bannedTerms: [],
      handleWithCare: [{ term: 'energy', rule: 'mental energy only' }],
      ctaSpamPatterns: [],
      outcomeTimeboxPatterns: ['in seconds', '/\\bwithin \\d+ days\\b/'],
    });
    expect(v.warnings.find((w) => w.code === 'handle_with_care')?.message).toContain('mental energy only');
    expect(v.errors.map((e) => e.code)).toContain('outcome_timebox');
  });

  it('warns once per AI-prose pattern, with curly apostrophes, and skips the lazy-version beat', () => {
    const s = longScript();
    s.mechanism.spoken = `${s.mechanism.spoken} This isn’t willpower. It’s a pattern.`;
    s.lazyVersion.spoken = `${s.lazyVersion.spoken} the vision — your real one — shows up`;
    const v = validateVideoScript(s, {
      bannedTerms: [],
      aiProsePatterns: ["/\\b(?:isn't|wasn't)\\s+[^.!?\\n]{1,60}[.;:,]\\s+(?:it|this)(?:'s| is)\\b/", '/—[^—\\n]{0,140}—/'],
    });
    const aiProse = v.warnings.filter((w) => w.code === 'ai_prose');
    expect(aiProse).toHaveLength(1);
    expect(aiProse[0].path).toBe('mechanism.spoken');
    expect(v.pass).toBe(true);
  });

  it('applies no language checks when the rules are empty', () => {
    const s = longScript();
    s.mechanism.spoken = `${s.mechanism.spoken} unlock overnight`;
    expect(validateVideoScript(s, { bannedTerms: [] }).pass).toBe(true);
  });
});

describe('validateVideoScript: timing', () => {
  it('fails a short that overflows 60 seconds', () => {
    const s = shortScript();
    s.mechanism.spoken = words(140, 'long');
    const v = validateVideoScript(s, rules);
    expect(v.pass).toBe(false);
    expect(v.errors.map((e) => e.code)).toContain('total_too_long');
    expect(v.timing.totalSeconds).toBeGreaterThan(60);
  });

  it('counts pauses toward the runtime', () => {
    const s = shortScript();
    s.moves[0] = { ...s.moves[0], pauseSeconds: 40 };
    expect(validateVideoScript(s, rules).errors.map((e) => e.code)).toContain('total_too_long');
  });

  it('fails a hook over the limit', () => {
    const s = longScript();
    s.hook.spoken = words(50, 'hook');
    expect(validateVideoScript(s, rules).errors.map((e) => e.code)).toContain('hook_too_long');
  });

  it('fails a long-form under the minimum runtime', () => {
    const s = shortScript();
    const v = validateVideoScript({ ...s, variant: 'long' }, rules);
    expect(v.errors.map((e) => e.code)).toContain('total_too_short');
  });

  it('honours timing overrides from the rules', () => {
    const v = validateVideoScript(shortScript(), { ...rules, timing: { short: { totalMax: 20 } } });
    expect(v.errors.map((e) => e.code)).toContain('total_too_long');
  });

  it('counts words', () => {
    expect(countWords('  one two\nthree  ')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});

describe('validateVideoScript: schema', () => {
  it('reports schema errors for malformed input', () => {
    const v = validateVideoScript({ variant: 'medium', title: '' }, rules);
    expect(v.pass).toBe(false);
    expect(v.errors.every((e) => e.category === 'schema' || e.category === 'cta')).toBe(true);
  });
});

describe('generateValidatedVideoScript', () => {
  const brief = { title: 'Test angle', angle: 'x', audience: 'y' };

  it('returns on the first attempt when valid', async () => {
    const calls: string[] = [];
    const r = await generateValidatedVideoScript({
      variant: 'long',
      brief,
      rules,
      complete: async (_s, u) => {
        calls.push(u);
        return JSON.stringify(longScript());
      },
    });
    expect(calls).toHaveLength(1);
    expect(r.validation.pass).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it('runs one repair pass with the errors fed back', async () => {
    const calls: string[] = [];
    const bad = longScript();
    delete bad.mechanism.source;
    const r = await generateValidatedVideoScript({
      variant: 'long',
      brief,
      rules,
      complete: async (_s, u) => {
        calls.push(u);
        return calls.length === 1 ? '```json\n' + JSON.stringify(bad) + '\n```' : JSON.stringify(longScript());
      },
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('mechanism_unsourced');
    expect(r.attempts).toBe(2);
    expect(r.validation.pass).toBe(true);
    expect(r.history[0].pass).toBe(false);
  });

  it('stops after one repair and returns the failing result', async () => {
    const bad = longScript();
    delete bad.mechanism.source;
    const r = await generateValidatedVideoScript({ variant: 'long', brief, rules, complete: async () => JSON.stringify(bad) });
    expect(r.attempts).toBe(2);
    expect(r.validation.pass).toBe(false);
  });

  it('extracts JSON from fenced or prefixed output', () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('{"a":2}')).toEqual({ a: 2 });
    expect(extractJson('not json')).toBeNull();
  });
});
