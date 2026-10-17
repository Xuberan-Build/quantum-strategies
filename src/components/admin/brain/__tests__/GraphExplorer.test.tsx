import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureGaps, fixtureGraph, fixtureNodeDetail } from '@/lib/brain/graph-fixture';
import type { GraphCanvasProps } from '../graph/GraphCanvas';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/brain/graph',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
// WebGL is not available in jsdom: stand the canvas in with a list of its visible nodes.
vi.mock('../graph/GraphCanvas', () => ({
  webglAvailable: () => false,
  GraphCanvas: (p: GraphCanvasProps) => (
    <ul data-testid={`canvas-${p.variant ?? 'full'}`} data-highlights={p.highlightIds?.size ?? 0}>
      {p.nodes.map((n) => (
        <li key={n.id}>
          <button type="button" onClick={() => p.onNodeClick(n.id)}>
            {n.id}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

import { GraphExplorer } from '../graph/GraphExplorer';

const graph = fixtureGraph();

function mockFetch() {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.startsWith('/api/admin/brain/graph/node/')) {
      const id = url.slice('/api/admin/brain/graph/node/'.length).split('/').map(decodeURIComponent).join('/');
      const detail = fixtureNodeDetail(id);
      return detail ? json(detail) : json({ error: 'Node not found' }, 404);
    }
    if (url.startsWith('/api/admin/brain/graph/gaps')) return json({ rows: fixtureGaps(), available: true, fixture: true });
    if (url.startsWith('/api/admin/brain/graph')) return json(graph);
    if (url.startsWith('/api/admin/brain/feedback')) return json({ rows: [] });
    return json({ error: 'unexpected' }, 404);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const fullCanvas = () => screen.getByTestId('canvas-full');
const visibleIds = () => within(fullCanvas()).queryAllByRole('button').map((b) => b.textContent);

describe('GraphExplorer (synthetic fixture)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/admin/brain/graph');
    mockFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the graph, legend and filters, and flags the fixture', async () => {
    render(<GraphExplorer />);
    await waitFor(() => expect(visibleIds().length).toBe(graph.nodes.length));
    expect(screen.getByText('Dev fixture')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pillar\s*5/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(`${graph.nodes.length} nodes · ${graph.edges.length} links`, { exact: false })).toBeInTheDocument();
  });

  it('toggles a group off from the legend and writes it to the URL', async () => {
    render(<GraphExplorer />);
    await waitFor(() => expect(visibleIds().length).toBe(graph.nodes.length));
    fireEvent.click(screen.getByRole('button', { name: /^pillar\s*5$/i }));
    await waitFor(() => expect(visibleIds().some((id) => id?.startsWith('pillar:'))).toBe(false));
    expect(window.location.search).toContain('types=');
    expect(new URLSearchParams(window.location.search).get('types')!.split(',')).not.toContain('pillar');
  });

  it('hides orphans', async () => {
    render(<GraphExplorer />);
    await waitFor(() => expect(visibleIds().length).toBe(graph.nodes.length));
    const orphans = graph.nodes.filter((n) => n.degree === 0).length;
    expect(orphans).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Show orphans'));
    await waitFor(() => expect(visibleIds().length).toBe(graph.nodes.length - orphans));
    expect(window.location.search).toContain('orphans=0');
  });

  it('search jumps to a node and opens the panel with backlinks, quotes and notes', async () => {
    render(<GraphExplorer />);
    await waitFor(() => expect(visibleIds().length).toBe(graph.nodes.length));
    const box = screen.getByRole('combobox', { name: 'Search nodes' });
    fireEvent.change(box, { target: { value: 'Sample problem 1' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    const panel = await screen.findByRole('complementary', { name: 'Node: Sample problem 1' });
    expect(new URLSearchParams(window.location.search).get('node')).toBe('problem:fixture-problem-1');
    await within(panel).findByText(/Synthetic problem from the dev fixture/);
    expect(within(panel).getByText(/^Backlinks/)).toBeInTheDocument();
    expect(within(panel).getByText('Top quotes')).toBeInTheDocument();
    expect(within(panel).getByText('Notes for Claude')).toBeInTheDocument();
    expect(within(panel).getByRole('form', { name: 'Leave feedback' })).toBeInTheDocument();
    // mini local graph shows the node and its neighbours
    expect(within(within(panel).getByTestId('canvas-mini')).getByText('problem:fixture-problem-1')).toBeInTheDocument();

    // clicking a backlink moves the selection
    const quoteLink = within(panel).getAllByRole('button').find((b) => b.textContent?.startsWith('Sample quote'));
    fireEvent.click(quoteLink!);
    await screen.findByRole('complementary', { name: /^Node: Sample quote/ });

    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: /^Node:/ })).toBeNull());
    expect(window.location.search).not.toContain('node=');
  });

  it('restores a shared view from the URL', async () => {
    window.history.replaceState(null, '', '/admin/brain/graph?node=pillar%3Afixture-pillar-1&types=pillar,sub_pillar');
    render(<GraphExplorer />);
    await screen.findByRole('complementary', { name: 'Node: Sample pillar 1' });
    await waitFor(() => expect(visibleIds().length).toBeGreaterThan(0));
    expect(visibleIds().every((id) => id?.startsWith('pillar:') || id?.startsWith('sub_pillar:'))).toBe(true);
  });

  it('gaps view highlights gap nodes and lists them', async () => {
    render(<GraphExplorer />);
    await waitFor(() => expect(visibleIds().length).toBe(graph.nodes.length));
    fireEvent.click(screen.getByRole('button', { name: /^Gaps/ }));
    const list = await screen.findByRole('region', { name: 'Gaps' });
    await within(list).findByText(/problem without solution/i);
    await waitFor(() => expect(Number(fullCanvas().dataset.highlights)).toBe(fixtureGaps().length));
    expect(window.location.search).toContain('gaps=1');
  });
});

describe('GraphCanvas without WebGL', () => {
  it('explains instead of crashing', async () => {
    const { GraphCanvas } = await vi.importActual<typeof import('../graph/GraphCanvas')>('../graph/GraphCanvas');
    render(<GraphCanvas nodes={[]} edges={[]} selectedId={null} reducedMotion onNodeClick={() => {}} ariaLabel="graph" />);
    expect(await screen.findByText(/no WebGL/)).toBeInTheDocument();
  });
});
