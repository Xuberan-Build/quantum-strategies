import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const isReadLive = vi.fn<() => Promise<boolean>>();
vi.mock('@/lib/read/live', () => ({ isReadLive: () => isReadLive() }));

import ReadCta from '../ReadCta';

const renderCta = async (props: Parameters<typeof ReadCta>[0]) => render(await ReadCta(props));

describe('ReadCta', () => {
  beforeEach(() => isReadLive.mockReset());

  it('renders nothing while the Read is switched off', async () => {
    isReadLive.mockResolvedValue(false);
    const { container } = await renderCta({ utmSource: 'home' });
    expect(container.innerHTML).toBe('');
  });

  it('renders the fallback while the Read is switched off', async () => {
    isReadLive.mockResolvedValue(false);
    await renderCta({ utmSource: 'home', fallback: <a href="/products/beta/">Join the free beta</a> });
    expect(screen.getByText('Join the free beta')).toBeTruthy();
    expect(screen.queryByText(/Take the free Read/)).toBeNull();
  });

  it('links to the Read with the placement UTMs when live', async () => {
    isReadLive.mockResolvedValue(true);
    await renderCta({ utmSource: 'rite-system', utmTerm: 'top' });
    const href = screen.getByRole('link', { name: /Take the free Read/ }).getAttribute('href')!;
    const q = new URLSearchParams(href.split('?')[1]);
    expect(href).toMatch(/^\/read\/?\?/); // next/link drops the trailing slash outside the app config
    expect(q.get('utm_source')).toBe('rite-system');
    expect(q.get('utm_campaign')).toBe('read-cta');
    expect(q.get('utm_content')).toBe('read');
    expect(q.get('utm_term')).toBe('top');
  });

  it('compact style shows the name and short facts', async () => {
    isReadLive.mockResolvedValue(true);
    await renderCta({ utmSource: 'perception', compact: true });
    expect(screen.getByText('The Perception Read')).toBeTruthy();
    expect(screen.getByText('12 questions · About 5 minutes · Free')).toBeTruthy();
  });
});
