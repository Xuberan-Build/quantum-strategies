import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureQueue, fixtureTopic, fixtureTopicalMap } from '@/lib/brain/topical-map-fixture';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/brain/map',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { TopicalMapView } from '../map/TopicalMapView';

const map = fixtureTopicalMap();

function mockFetch() {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.startsWith('/api/admin/brain/map/topic/')) {
      const id = url.slice('/api/admin/brain/map/topic/'.length).split('/').map(decodeURIComponent).join('/');
      const t = fixtureTopic(id);
      return t ? json(t) : json({ error: 'Topic not found' }, 404);
    }
    if (url.startsWith('/api/admin/brain/map/queue')) return json({ items: fixtureQueue(20), fixture: true });
    if (url.startsWith('/api/admin/brain/map')) return json(map);
    if (url.startsWith('/api/admin/brain/feedback')) return json({ rows: [] });
    return json({ error: 'unexpected' }, 404);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const arcs = () => document.querySelectorAll('path[data-id]');

describe('TopicalMapView (synthetic fixture)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/admin/brain/map');
    mockFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the central entity, the rings, the legend and the make-next queue', async () => {
    render(<TopicalMapView />);
    await screen.findByText(/Synthetic definition from the dev fixture/);
    expect(screen.getAllByText('Sample central entity').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dev fixture').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/topics have a LIVE asset/);
    expect(screen.getByText('Why it matters', { exact: false })).toBeInTheDocument();
    // Pillars, sections and topics are drawn; subtopics wait for a zoom.
    expect(arcs().length).toBeGreaterThan(50);
    expect([...arcs()].some((p) => p.getAttribute('data-id')!.includes('subtopic'))).toBe(false);
    // Legend has a plain-language definition for the current metric.
    expect(screen.getByText('Priority:').parentElement!.textContent).toMatch(/What to make next/);

    const queue = screen.getByRole('complementary', { name: 'Make next' });
    await waitFor(() => expect(within(queue).getAllByRole('listitem')).toHaveLength(20));
    expect(within(queue).getAllByText(/demand/i).length).toBeGreaterThan(0);
  });

  it('opens a topic from the queue with scores, why lines, graph link and comments', async () => {
    render(<TopicalMapView />);
    const queue = await screen.findByRole('complementary', { name: 'Make next' });
    const first = fixtureQueue(1)[0];
    fireEvent.click(await within(queue).findByText(first.label));

    const panel = await screen.findByRole('complementary', { name: `Topic: ${first.label}` });
    expect(new URLSearchParams(window.location.search).get('topic')).toBe(first.id);
    await within(panel).findByText(/sample search phrasing 1/);
    expect(within(panel).getByText('Product fit')).toBeInTheDocument();
    expect(within(panel).getByText(/Number 1 of \d+ in the make-next queue/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Open in graph/ })).toHaveAttribute('href', `/admin/brain/graph?node=${encodeURIComponent(first.id)}`);
    expect(within(panel).getByText('Comments for Claude')).toBeInTheDocument();
    expect(within(panel).getByRole('form', { name: 'Leave feedback' })).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Close topic' }));
    await screen.findByRole('complementary', { name: 'Make next' });
    expect(window.location.search).not.toContain('topic=');
  });

  it('zooms into a pillar on click and back out from the centre', async () => {
    render(<TopicalMapView />);
    await screen.findByText(/Synthetic definition from the dev fixture/);
    const pillar = document.querySelector('path[data-id="topic:fixture-pillar-2"]')!;
    fireEvent.click(pillar);
    await waitFor(() => expect([...arcs()].some((p) => p.getAttribute('data-id')!.includes('subtopic-2-'))).toBe(true));
    expect([...arcs()].every((p) => /-2(-|$)/.test(p.getAttribute('data-id')!))).toBe(true);
    expect(new URLSearchParams(window.location.search).get('topic')).toBe('topic:fixture-pillar-2');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out from Sample pillar 2' }));
    await screen.findByText(/Synthetic definition from the dev fixture/);
  });

  it('switches the colour metric and filters, writing both to the URL', async () => {
    render(<TopicalMapView />);
    await screen.findByText(/Synthetic definition from the dev fixture/);
    fireEvent.click(screen.getByRole('radio', { name: 'Demand' }));
    expect(new URLSearchParams(window.location.search).get('metric')).toBe('demand');
    expect(screen.getByText('Demand:').parentElement!.textContent).toMatch(/How often people search and talk about this/);

    fireEvent.click(screen.getByRole('button', { name: 'LIVE' }));
    expect(new URLSearchParams(window.location.search).get('status')).toBe('LIVE');
    await waitFor(() => expect([...arcs()].some((p) => p.parentElement!.getAttribute('opacity') === '0.16')).toBe(true));

    fireEvent.change(screen.getByLabelText('Pillar'), { target: { value: 'P3' } });
    expect(new URLSearchParams(window.location.search).get('pillar')).toBe('P3');
  });

  it('restores a shared view from the URL', async () => {
    window.history.replaceState(null, '', '/admin/brain/map?topic=topic%3Afixture-topic-3-1-1&metric=proof');
    render(<TopicalMapView />);
    await screen.findByRole('complementary', { name: 'Topic: Sample topic 3.1.1' });
    expect(screen.getByRole('radio', { name: 'Proof' })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(document.querySelector('path[data-id="topic:fixture-topic-3-1-1"]')).not.toBeNull());
  });

  it('search jumps to a topic', async () => {
    render(<TopicalMapView />);
    await screen.findByText(/Synthetic definition from the dev fixture/);
    const box = screen.getByRole('combobox', { name: 'Search topics' });
    fireEvent.change(box, { target: { value: 'Sample topic 4.2.1' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await screen.findByRole('complementary', { name: 'Topic: Sample topic 4.2.1' });
  });
});
