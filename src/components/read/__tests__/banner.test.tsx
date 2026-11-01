import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { BANNER_DISMISS_KEY } from '@/lib/read/cta';
import { READ_CTA_COPY } from '@/lib/read/cta-copy';
import { ReadBannerClient } from '../cta/ReadBannerClient';

describe('ReadBannerClient', () => {
  it('links to /read/ with the banner UTM set for the current page', () => {
    vi.mocked(usePathname).mockReturnValue('/articles/some-post/');
    render(<ReadBannerClient />);
    const link = screen.getByRole('link', { name: READ_CTA_COPY.banner.button });
    // next/link applies trailingSlash from next.config at runtime; the test env has none.
    expect(link.getAttribute('href')).toMatch(
      /^\/read\/?\?utm_source=site&utm_medium=banner&utm_content=articles-some-post$/,
    );
    expect(screen.getByText(READ_CTA_COPY.banner.line)).toBeInTheDocument();
  });

  it('renders nothing on the Read itself', () => {
    vi.mocked(usePathname).mockReturnValue('/read/start/');
    const { container } = render(<ReadBannerClient />);
    expect(container).toBeEmptyDOMElement();
  });

  it('dismisses for 14 days', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<ReadBannerClient />);
    const before = Date.now();
    fireEvent.click(screen.getByRole('button', { name: READ_CTA_COPY.banner.dismissLabel }));
    expect(document.documentElement.getAttribute('data-read-banner')).toBe('off');
    const until = Number(window.localStorage.getItem(BANNER_DISMISS_KEY));
    expect(until - before).toBeGreaterThanOrEqual(14 * 24 * 60 * 60 * 1000 - 1000);
    document.documentElement.removeAttribute('data-read-banner');
    window.localStorage.removeItem(BANNER_DISMISS_KEY);
  });

  it('still hides when storage is blocked', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<ReadBannerClient />);
    fireEvent.click(screen.getByRole('button', { name: READ_CTA_COPY.banner.dismissLabel }));
    expect(document.documentElement.getAttribute('data-read-banner')).toBe('off');
    spy.mockRestore();
    document.documentElement.removeAttribute('data-read-banner');
  });
});
