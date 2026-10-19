import { describe, it, expect } from 'vitest';
import { buildSeries, mergeArticles, readingMinutes, relatedFor, topicCounts, topicSlug, type IndexArticle } from '../article-index';

const a = (slug: string, over: Partial<IndexArticle> = {}): IndexArticle => ({
  slug,
  title: slug,
  description: '',
  date: '2026-01-01',
  topic: 'Mindset & Worldview',
  topicSlug: 'mindset-and-worldview',
  tags: [],
  readingMinutes: 5,
  ...over,
});

describe('article index', () => {
  it('slugs topics', () => {
    expect(topicSlug('Growth & Marketing')).toBe('growth-and-marketing');
  });

  it('estimates reading time without counting comments', () => {
    expect(readingMinutes(`${'word '.repeat(460)}<!-- ${'x '.repeat(5000)} -->`)).toBe(2);
    expect(readingMinutes('')).toBe(1);
  });

  it('lets DB posts win over MDX files with the same slug, newest first', () => {
    const merged = mergeArticles(
      [a('shared', { title: 'db' }), a('new', { date: '2026-10-19' })],
      [a('shared', { title: 'mdx' }), a('old', { date: '2024-01-01' })],
    );
    expect(merged.map((x) => x.slug)).toEqual(['new', 'shared', 'old']);
    expect(merged.find((x) => x.slug === 'shared')?.title).toBe('db');
  });

  it('counts topics, biggest first', () => {
    const counts = topicCounts([a('1'), a('2'), a('3', { topic: 'Business Strategy' })]);
    expect(counts[0]).toEqual({ topic: 'Mindset & Worldview', slug: 'mindset-and-worldview', count: 2 });
  });

  it('orders the attention series from the hub and waveforms by episode', () => {
    const tag = ['series:attention-and-perception'];
    const series = buildSeries([
      a('self-image', { tags: tag }),
      a('reticular-activating-system', { tags: tag }),
      a('episode-10-measurement'),
      a('episode-02-amplitude'),
      a('unrelated'),
    ]);
    expect(series.map((s) => s.id)).toEqual(['attention-and-perception', 'waveforms']);
    expect(series[0].articles.map((x) => x.slug)).toEqual(['reticular-activating-system', 'self-image']);
    expect(series[1].articles.map((x) => x.slug)).toEqual(['episode-02-amplitude', 'episode-10-measurement']);
  });
});

describe('relatedFor', () => {
  const tag = ['series:attention-and-perception'];
  const list = mergeArticles(
    [
      a('reticular-activating-system', { tags: tag, date: '2026-10-19' }),
      a('selective-attention', { tags: tag, date: '2026-10-19' }),
      a('baader-meinhof-phenomenon', { tags: tag, date: '2026-10-19' }),
      a('older-mindset', { date: '2026-05-01' }),
      a('other-topic', { topic: 'Business Strategy' }),
    ],
    [],
  );

  it('links previous and next in the series and fills from the same topic', () => {
    const r = relatedFor('selective-attention', list);
    expect(r.series?.prev?.slug).toBe('reticular-activating-system');
    expect(r.series?.next?.slug).toBe('baader-meinhof-phenomenon');
    expect(r.more.map((x) => x.slug)).toEqual(['older-mindset']);
  });

  it('works for an article outside any series and never links itself', () => {
    const r = relatedFor('older-mindset', list);
    expect(r.series).toBeUndefined();
    expect(r.more.map((x) => x.slug)).not.toContain('older-mindset');
    expect(r.more.map((x) => x.slug)).not.toContain('other-topic');
  });
});
