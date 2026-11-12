// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bestExcerpt,
  formatHit,
  isNoise,
  orQuery,
  parseArgs,
  queryPhrase,
  queryTerms,
  rankRows,
  reference,
  rightsHint,
  scorePassage,
  stripHeading,
  type CorpusRow,
} from '../format';

const row = (over: Partial<CorpusRow>): CorpusRow => ({
  id: 'id-1',
  tradition: 'sufism',
  text_name: 'masnavi',
  author: 'Rumi',
  translator: 'E.H. Whinfield',
  date_composed: '~1258 CE',
  book: '1',
  chapter: '12',
  verse: null,
  section: 'joseph_and_the_mirror',
  content: 'A friend brought Joseph a mirror, begging him to admire his own beauteous face in it.',
  source_url: 'https://example.org/masnavi',
  tier: 'lineage',
  metadata: null,
  ...over,
});

describe('query terms', () => {
  it('drops stopwords, operators and negations, stems lightly, de-duplicates', () => {
    expect(queryTerms('The stalls and the stalling -kybalion or "dark night"')).toEqual(['stall', 'dark', 'night']);
    expect(queryTerms('I can’t say no')).toEqual(['say']);
    expect(orQuery(['stall', 'dark'])).toBe('stall or dark');
  });
  it('takes a quoted phrase, else a short query as the phrase', () => {
    expect(queryPhrase('"walk alone" weaning')).toBe('walk alone');
    expect(queryPhrase('muddy water still')).toBe('muddy water still');
    expect(queryPhrase('water')).toBeNull();
  });
});

describe('scoring and noise', () => {
  it('rewards distinct terms and the phrase', () => {
    const both = scorePassage('Let the muddy water be still and it will clear.', ['muddy', 'water'], 'muddy water');
    const one = scorePassage('Water flows down to the sea.', ['muddy', 'water'], 'muddy water');
    expect(both.matched).toEqual(['muddy', 'water']);
    expect(both.score).toBeGreaterThan(one.score);
    expect(scorePassage('nothing relevant here at all', ['mirror'], null).score).toBe(0);
  });
  it('flags scan noise', () => {
    expect(isNoise('Digitized by Google BROTHER MUSICIANS. Crown 8vo. 6s. net. lorem ipsum dolor sit amet consectetur adipiscing')).toBe(true);
    expect(isNoise('short')).toBe(true);
    expect(isNoise('The soul is like a castle made of a single diamond, in which there are many rooms, as in heaven there are many mansions.')).toBe(false);
  });
});

describe('excerpts', () => {
  it('strips the chunk heading', () => {
    expect(stripHeading('Dark Night of the Soul — Book 1, Chapter I St. John of the Cross (~1578 CE), E. Allison Peers translation CHAPTER I Sets down the first line and begins to treat of the imperfections of beginners.')).toMatch(/^CHAPTER I Sets down/);
  });
  it('centres on the window with most terms and trims to whole words', () => {
    const long = `${'filler words go here '.repeat(40)}the reed flute complains of separation from the reed bed ${'more filler text '.repeat(40)}`;
    const ex = bestExcerpt(long, ['reed', 'separation'], 120);
    expect(ex).toContain('reed flute complains of separation');
    expect(ex.startsWith('…')).toBe(true);
    expect(ex.endsWith('…')).toBe(true);
    expect(ex.length).toBeLessThanOrEqual(122);
  });
});

describe('references and rights', () => {
  it('builds a reference from columns and metadata', () => {
    expect(reference(row({ book: '4', chapter: '3', section: 'mansion_4_chapter_3', metadata: { section_label: 'Mansion 4, Chapter 3' } }))).toBe('Bk 4 · ch. 3 · Mansion 4, Chapter 3');
    expect(reference(row({ book: 'Bereshit', chapter: '40', verse: '2' }))).toBe('Bereshit · ch. 40 · v. 2');
  });
  it('separates quotable, paraphrase-only, unknown and research', () => {
    expect(rightsHint(row({ content: 'Masnavi, Whinfield translation (1898) text' })).status).toBe('public-domain');
    expect(rightsHint(row({ translator: 'Nevit Oguz Ergin' })).status).toBe('paraphrase');
    expect(rightsHint(row({ translator: 'E. Allison Peers' })).status).toBe('paraphrase');
    expect(rightsHint(row({ translator: null, content: 'Practice of the Presence — FIRST CONVERSATION Brother Lawrence (~1666 CE) He told me' })).status).toBe('check');
    expect(rightsHint(row({ tradition: 'science', tier: 'evidence' })).status).toBe('paper');
    expect(rightsHint(row({ translator: 'F. Max Müller', metadata: { translation_year: 1879 } })).status).toBe('public-domain');
    expect(rightsHint(row({ translator: null, date_composed: '1914 CE', content: 'The Mystics of Islam, Nicholson' })).status).toBe('public-domain');
    expect(rightsHint(row({ translator: null, content: 'Revelations of Divine Love — Chapter 5 Julian of Norwich (1373 CE), Grace Warrack edition (1901) text' })).status).toBe('public-domain');
  });
});

describe('ranking and output', () => {
  it('ranks, skips empties and caps passages per text', () => {
    const rows = [
      row({ id: 'a', content: 'He held up the mirror to his own face, a mirror of beauty, and the beauty saw itself in it.' }),
      row({ id: 'b', content: 'A friend brought a mirror to the house of a man who already had everything he wanted.' }),
      row({ id: 'c', content: 'Your beauty made the slave into a mirror, and when the mirror broke the hands were wounded.', text_name: 'divan_e_shams' }),
      row({ id: 'd', content: null }),
      row({ id: 'a', content: 'duplicate id' }),
    ];
    const hits = rankRows(rows, 'mirror beauty', 10, 1);
    expect(hits.map((h) => h.row.id)).toEqual(['a', 'c']);
  });
  it('prints id, rights and excerpt', () => {
    const [h] = rankRows([row({})], 'mirror', 1, 1);
    const out = formatHit(h, 0);
    expect(out).toContain('1. [sufism] masnavi');
    expect(out).toContain('chunk id-1 · tier lineage');
    expect(out).toContain('rights: check');
    expect(out).toContain('"A friend brought Joseph a mirror');
  });
});

describe('args', () => {
  it('parses flags and joins the query', () => {
    const o = parseArgs(['walk', 'alone', '--tradition', 'sufism, taoism', '--limit', '5', '--json', '--tiers', 'all']);
    expect(o).toMatchObject({ query: 'walk alone', traditions: ['sufism', 'taoism'], limit: 5, json: true, tiers: null });
  });
  it('refuses an empty query or an unknown flag', () => {
    expect(() => parseArgs([])).toThrow(/usage/);
    expect(() => parseArgs(['x', '--nope'])).toThrow(/unknown flag/);
  });
});
