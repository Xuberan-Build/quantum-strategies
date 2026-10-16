import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const download = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { storage: { from: vi.fn(() => ({ download })) } },
}));

import {
  FALLBACK_VOICE_PACK,
  buildVoiceSystemPrompt,
  compilePattern,
  findBannedTerms,
  findPatternMatches,
  getFormatVoiceRules,
  getVoicePack,
  getVoicePackResult,
  parseVoicePack,
  parseVoicePackFromSnapshotText,
  resetVoicePackCache,
  type VoicePack,
} from '../voice-pack';
import { BrainSnapshotSchema } from '@/lib/brain/snapshot';

const PACK: VoicePack = {
  version: '2026-10-16',
  voiceRules: ['Rule one.', 'Rule two.'],
  canon: [{ term: 'Term', meaning: 'Means a thing.', use: 'Openers.', avoid: 'Titles.' }],
  bannedTerms: ['banned phrase', "here's the truth"],
  handleWithCare: [{ term: 'careful', rule: 'Only when defined.' }],
  ctaSpamPatterns: ['this one quiz', '/\\bchanged my (whole )?life\\b/i'],
  outcomeTimeboxPatterns: ['/\\bin \\d+ days\\b/i'],
  identity: { brand: 'Brand', identityTerm: 'Builder', stages: ['Start', 'Middle'], audience: 'People who build.', positioning: 'Mechanism first.' },
  chartPolicy: 'Charts are data, not causes.',
  systemPreamble: 'You write for Brand.',
};

function blobOf(value: unknown) {
  return { text: async () => (typeof value === 'string' ? value : JSON.stringify(value)) };
}

describe('parseVoicePack', () => {
  it('accepts a complete pack', () => {
    const result = parseVoicePack(PACK);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.identity.identityTerm).toBe('Builder');
  });

  it('rejects a missing pack', () => {
    expect(parseVoicePack(undefined)).toEqual({ ok: false, error: 'Snapshot has no voicePack.' });
  });

  it('rejects an invalid pack with the failing path', () => {
    const result = parseVoicePack({ ...PACK, voiceRules: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('voiceRules');
  });

  it('reads voicePack from snapshot text even when the rest of the snapshot is partial', () => {
    expect(parseVoicePackFromSnapshotText(JSON.stringify({ version: 1, voicePack: PACK })).ok).toBe(true);
    expect(parseVoicePackFromSnapshotText('{not json').ok).toBe(false);
    expect(parseVoicePackFromSnapshotText(JSON.stringify({ version: 1 })).ok).toBe(false);
  });

  it('keeps BrainSnapshotSchema backward compatible (voicePack is optional)', () => {
    const shape = BrainSnapshotSchema.shape;
    expect(shape.voicePack.isOptional()).toBe(true);
  });

  it('the built-in fallback is itself a valid pack and carries no anti-citation rule', () => {
    expect(parseVoicePack(FALLBACK_VOICE_PACK).ok).toBe(true);
    const text = FALLBACK_VOICE_PACK.voiceRules.join(' ').toLowerCase();
    expect(text).not.toContain('not credentials or citations');
    expect(FALLBACK_VOICE_PACK.bannedTerms).toEqual(expect.arrayContaining(["here's the truth", 'unlock', 'level up']));
  });
});

describe('getVoicePack (loading, fallback, cache)', () => {
  beforeEach(() => {
    resetVoicePackCache();
    download.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the snapshot pack from Storage', async () => {
    download.mockResolvedValue({ data: blobOf({ version: 1, voicePack: PACK }), error: null });
    const result = await getVoicePackResult();
    expect(result.source).toBe('snapshot');
    expect(result.pack.version).toBe('2026-10-16');
  });

  it('falls back when Storage errors', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    const result = await getVoicePackResult();
    expect(result.source).toBe('fallback');
    expect(result.pack).toBe(FALLBACK_VOICE_PACK);
    expect(result.error).toContain('Object not found');
  });

  it('falls back when the snapshot has no voicePack (older snapshots)', async () => {
    download.mockResolvedValue({ data: blobOf({ version: 1, decks: [] }), error: null });
    expect((await getVoicePackResult()).source).toBe('fallback');
  });

  it('falls back when the download throws', async () => {
    download.mockRejectedValue(new Error('network down'));
    const result = await getVoicePackResult();
    expect(result.source).toBe('fallback');
    expect(result.error).toContain('network down');
  });

  it('caches within the TTL and dedupes concurrent loads', async () => {
    download.mockResolvedValue({ data: blobOf({ voicePack: PACK }), error: null });
    const [a, b] = await Promise.all([getVoicePack(), getVoicePack()]);
    await getVoicePack();
    expect(a).toBe(b);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('reloads after the cache is reset', async () => {
    download.mockResolvedValue({ data: blobOf({ voicePack: PACK }), error: null });
    await getVoicePack();
    resetVoicePackCache();
    await getVoicePack();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('exposes the format-validator fields', async () => {
    download.mockResolvedValue({ data: blobOf({ voicePack: PACK }), error: null });
    expect(await getFormatVoiceRules()).toEqual({
      bannedTerms: PACK.bannedTerms,
      handleWithCare: PACK.handleWithCare,
      ctaSpamPatterns: PACK.ctaSpamPatterns,
      outcomeTimeboxPatterns: PACK.outcomeTimeboxPatterns,
    });
  });
});

describe('matching helpers', () => {
  it('finds banned terms case-insensitively, with curly quotes, from a word start', () => {
    const hits = findBannedTerms('So, Here’s The Truth about it. Also unlocked doors.', { bannedTerms: ["here's the truth", 'unlock'] });
    expect(hits.map((h) => h.pattern)).toEqual(["here's the truth", 'unlock']);
    expect(findBannedTerms('the deadlock persists', { bannedTerms: ['lock'] })).toHaveLength(0);
  });

  it('treats /source/flags entries as regex and everything else as literal', () => {
    expect(compilePattern('/\\bin \\d+ days\\b/i').test('Change it IN 30 DAYS')).toBe(true);
    expect(compilePattern('a.b').test('axb')).toBe(false);
    expect(compilePattern('a.b').test('A.B')).toBe(true);
    // invalid regex degrades to a literal match instead of throwing
    expect(() => compilePattern('/([/')).not.toThrow();
  });

  it('reports excerpts for CTA and timebox patterns', () => {
    const hits = findPatternMatches('Honestly this changed my whole life in 30 days.', [...PACK.ctaSpamPatterns, ...PACK.outcomeTimeboxPatterns]);
    expect(hits).toHaveLength(2);
    expect(hits[0].excerpt).toContain('changed my whole life');
  });
});

describe('buildVoiceSystemPrompt', () => {
  it('includes preamble, role, identity, rules, banned terms, care rules and chart policy', () => {
    const prompt = buildVoiceSystemPrompt(PACK, { role: 'You write sections.' });
    expect(prompt.startsWith('You write for Brand.')).toBe(true);
    expect(prompt).toContain('You write sections.');
    expect(prompt).toContain('"Builder", reached through Start → Middle');
    expect(prompt).toContain('- Rule one.');
    expect(prompt).toContain('"banned phrase"');
    expect(prompt).toContain('careful: Only when defined.');
    expect(prompt).toContain('Charts are data, not causes.');
    expect(prompt).not.toContain('CANON LINES');
  });

  it('adds canon only when asked', () => {
    expect(buildVoiceSystemPrompt(PACK, { includeCanon: true })).toContain('Term: Means a thing.');
  });

  it('omits the identity block for the generic fallback', () => {
    expect(buildVoiceSystemPrompt(FALLBACK_VOICE_PACK)).not.toContain('IDENTITY AND POSITIONING');
  });
});
