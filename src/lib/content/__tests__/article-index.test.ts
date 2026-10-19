import { describe, it, expect } from 'vitest';
import { buildSeries, mergeArticles, readingMinutes, topicCounts, topicSlug, type IndexArticle } from '../article-index';

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
