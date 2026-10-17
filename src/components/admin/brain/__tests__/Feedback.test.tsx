import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { splitDoc } from '@/lib/brain/doc-sections';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import type { BrainDeck, DocIndexEntry, PillarSlug } from '@/lib/brain/snapshot';
import { DeckPresenter } from '../DeckPresenter';
import { DocReader } from '../DocReader';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/brain/deck/d1',
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => vi.restoreAllMocks());

/* Synthetic fixtures. No real brain content. */
const note = (extra: Partial<BrainFeedbackRow>): BrainFeedbackRow => ({
  id: '0b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a',
  created_at: '2026-10-17T10:00:00Z',
  updated_at: null,
  author_id: null,
  target_type: 'doc',
  target_id: 'notes--guide',
  deck_id: null,
  slide_id: null,
  anchor: null,
  kind: 'question',
  body: 'Why this order?',
  status: 'answered',
  resolved_note: null,
  reply: 'Because the steps depend on each other.',
  replied_at: '2026-10-17T11:00:00Z',
  synced_to_brain_at: null,
  ...extra,
});

const MD = '# Guide\n\n## Steps\n\nFirst do the setup, then run it.\n\nUnrelated closing line.\n';
const entry: DocIndexEntry = {
  slug: 'notes--guide',
  title: 'Guide',
  path: 'notes/guide.md',
  hash: 'h2',
  updatedAt: '2026-10-17T00:00:00Z',
  publishedAt: '2026-10-17T00:00:00Z',
  bytes: MD.length,
  versions: [
    { hash: 'h2', publishedAt: '2026-10-17T00:00:00Z' },
    { hash: 'h1', publishedAt: '2026-10-10T00:00:00Z' },
  ],
};

describe('DocReader', () => {
  it('shows a note and Claude’s reply beside the section it quotes, even from an older version', () => {
    const rows = [note({ anchor: { headingPath: ['Guide', 'Steps'], quote: 'do the setup', versionHash: 'h1', blockId: 'gone' } })];
    const { container } = render(<DocReader entry={entry} hash="h2" blocks={splitDoc(MD)} feedback={rows} />);
    const block = container.querySelector('[data-block-id]:not([data-block-id^="guide"])') as HTMLElement;
    expect(block.textContent).toContain('First do the setup');
    const row = block.parentElement as HTMLElement;
    expect(within(row).getByText('Why this order?')).toBeInTheDocument();
    expect(within(row).getByText('Because the steps depend on each other.')).toBeInTheDocument();
    expect(within(row).getByText('Answered')).toBeInTheDocument();
    expect(within(row).getByText(/Left on version #h1/)).toBeInTheDocument();
  });

  it('posts a doc comment with heading path, quote and version', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ row: note({ ...body, id: '1b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a', status: 'open', reply: null }) }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<DocReader entry={entry} hash="h2" blocks={splitDoc(MD)} feedback={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Comment on: First do the setup/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Idea' }));
    fireEvent.change(screen.getByPlaceholderText(/What should change/), { target: { value: 'Add a diagram.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(screen.getByText('Add a diagram.')).toBeInTheDocument());
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sent).toMatchObject({
      target_type: 'doc',
      target_id: 'notes--guide',
      kind: 'idea',
      body: 'Add a diagram.',
      anchor: { headingPath: ['Guide', 'Steps'], versionHash: 'h2', docPath: 'notes/guide.md' },
    });
    expect(sent.anchor.quote).toContain('First do the setup');
    vi.unstubAllGlobals();
  });
});

describe('DeckPresenter feedback + sources', () => {
  const deck: BrainDeck = {
    id: 'd1',
    title: 'Deck',
    period: '2026-10-17',
    summary: 's',
    slides: [
      { id: 'a', kind: 'headline', title: 'Slide A', sources: ['notes/a.md', 'https://claude.ai/artifact/abc'] },
      { id: 'b', kind: 'headline', title: 'Slide B' },
    ],
  };
  const titles = {} as Record<PillarSlug, string>;

  it('hides the Feedback control without feedback data', () => {
    render(<DeckPresenter deck={deck} pillarTitles={titles} />);
    expect(screen.queryByRole('button', { name: /^Feedback/ })).toBeNull();
  });

  it('shows slide notes and renders http sources as external links', () => {
    const rows = [note({ target_type: 'slide', target_id: 'd1', deck_id: 'd1', slide_id: 'a', body: 'Sharper headline.', reply: null, status: 'open' })];
    render(<DeckPresenter deck={deck} pillarTitles={titles} feedback={{ rows }} externalUrl="https://claude.ai/artifact/deck" />);
    expect(screen.getByRole('button', { name: 'Feedback (1)' })).toBeInTheDocument();
    expect(screen.getByText('Sharper headline.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open original/ })).toHaveAttribute('href', 'https://claude.ai/artifact/deck');
    const external = screen.getByText('claude.ai/artifact/abc').closest('a');
    expect(external).toHaveAttribute('href', 'https://claude.ai/artifact/abc');
    expect(screen.getByText('brain/notes/a.md').closest('a')?.getAttribute('href')).toContain('github.com');
  });
});
