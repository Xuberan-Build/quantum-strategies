import { describe, expect, it } from 'vitest';
import { parseUtm, resolveVariant } from '@/components/read/utm';
import {
  BANNER_DISMISS_KEY,
  BANNER_PREPAINT_SCRIPT,
  buildReadHref,
  shouldShowBanner,
  slugForPath,
  termFromTags,
} from '../cta';

const query = (href: string) => new URLSearchParams(href.split('?')[1] ?? '');

describe('shouldShowBanner', () => {
  it.each([
    '/',
    '/articles/',
    '/articles/some-post/',
    '/pillars/self-image/',
    '/meet/',
    '/values/',
    '/whitepapers/x/',
    '/products/perception/',
    '/resources/',
  ])('shows on %s', (path) => {
    expect(shouldShowBanner(path)).toBe(true);
  });

  it.each([
    '/read',
    '/read/',
    '/read/start/',
    '/read/result/abc/',
    '/read/checkout/',
    '/dashboard/',
    '/dashboard/library/',
    '/admin/',
    '/admin/brain/decks/',
    '/products/perception/experience/',
    '/products/perception/experience',
    '/products/personal-alignment/interact/',
    '/login/',
    '/signup/',
    '/forgot-password/',
    '/reset-password/',
    '/auth/callback/',
    '/onboarding/',
    '/unsubscribe/',
    '/checkout/',
    '/products/x/checkout/',
    '/READ/START/',
  ])('hides on %s', (path) => {
    expect(shouldShowBanner(path)).toBe(false);
  });

  it('does not hide lookalike paths', () => {
    expect(shouldShowBanner('/reading-list/')).toBe(true);
    expect(shouldShowBanner('/administer/')).toBe(true);
  });

  it('hides when the path is unknown', () => {
    expect(shouldShowBanner(null)).toBe(false);
    expect(shouldShowBanner('')).toBe(false);
  });
});

describe('slugForPath and termFromTags', () => {
  it('turns a path into a slug', () => {
    expect(slugForPath('/')).toBe('home');
    expect(slugForPath('/articles/some-post/')).toBe('articles-some-post');
    expect(slugForPath('/meet/?x=1')).toBe('meet');
  });

  it('joins tags, deduped and slugged', () => {
    expect(termFromTags(['self-image', 'Self Image', null, 'Operations & Systems'])).toBe('self-image,operations-systems');
    expect(termFromTags([])).toBeUndefined();
    expect(termFromTags(undefined)).toBeUndefined();
  });

  it('keeps utm_term within the 200 characters /read stores', () => {
    const tags = Array.from({ length: 40 }, (_, i) => `topic-number-${i}`);
    const term = termFromTags(tags)!;
    expect(term.length).toBeLessThanOrEqual(200);
    expect(term.startsWith('topic-number-0,topic-number-1')).toBe(true);
  });
});

describe('buildReadHref', () => {
  it('builds the banner link', () => {
    const href = buildReadHref({ medium: 'banner', content: 'articles-some-post' });
    expect(href.startsWith('/read/?')).toBe(true);
    expect(Object.fromEntries(query(href))).toEqual({
      utm_source: 'site',
      utm_medium: 'banner',
      utm_content: 'articles-some-post',
    });
  });

  it('builds the article links with topic tags in utm_term', () => {
    const href = buildReadHref({ medium: 'sidebar', content: 'some-post', terms: ['self-image', 'the-shoulds'] });
    expect(query(href).get('utm_term')).toBe('self-image,the-shoulds');
    expect(query(href).get('utm_medium')).toBe('sidebar');
  });

  it('sends params that /read already parses into ReadUtm', () => {
    const href = buildReadHref({ medium: 'inline', content: 'some-post', terms: ['operations'] });
    expect(parseUtm(query(href))).toEqual({
      source: 'site',
      medium: 'inline',
      content: 'some-post',
      term: 'operations',
    });
  });

  it('never switches the landing line or the manifestation variant by accident', () => {
    const href = buildReadHref({ medium: 'sidebar', content: 'method' });
    expect(query(href).get('utm_content')).toBe('page-method');
    expect(resolveVariant(query(href))).toBeUndefined();
    expect(query(buildReadHref({ medium: 'banner', content: 'stall' })).get('utm_content')).toBe('page-stall');
  });

  it('leaves out empty content and terms', () => {
    const href = buildReadHref({ medium: 'home', content: '', terms: [null] });
    expect(Object.fromEntries(query(href))).toEqual({ utm_source: 'site', utm_medium: 'home' });
  });
});

describe('banner pre-paint script', () => {
  it('reads the dismissal key and survives blocked storage', () => {
    expect(BANNER_PREPAINT_SCRIPT).toContain(BANNER_DISMISS_KEY);
    expect(BANNER_PREPAINT_SCRIPT.startsWith('try{')).toBe(true);
  });

  it('hides the banner while the dismissal is in the future', () => {
    document.documentElement.removeAttribute('data-read-banner');
    window.localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now() + 60_000));
    new Function(BANNER_PREPAINT_SCRIPT)();
    expect(document.documentElement.getAttribute('data-read-banner')).toBe('off');

    document.documentElement.removeAttribute('data-read-banner');
    window.localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now() - 1));
    new Function(BANNER_PREPAINT_SCRIPT)();
    expect(document.documentElement.getAttribute('data-read-banner')).toBeNull();
    window.localStorage.removeItem(BANNER_DISMISS_KEY);
  });
});
