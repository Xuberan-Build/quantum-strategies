import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deckContentHash } from '@/lib/brain/deck-reads';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import type { BrainDeck, BrainSlide, PillarSlug } from '@/lib/brain/snapshot';
import { DeckSchema } from '@/lib/brain/snapshot';
import { DeckPresenter } from '../DeckPresenter';
import { SlideRenderer } from '../SlideRenderer';
import { clampIndex, keyToAction, parseSlideParam } from '../deckNavigation';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/* Synthetic, generic fixture. No real brain content. */
const slides: BrainSlide[] = [
  {
    id: 'one',
    kind: 'headline',
    title: 'Alpha headline',
    subtitle: 'A synthetic subtitle',
    body: 'Synthetic body copy for the headline.',
    tags: { rite: 'perception', pillar: 'architecture-of-self' },
    sources: ['notes/alpha.md', 'notes/beta.md'],
  },
  {
    id: 'two',
    kind: 'stats',
    title: 'Beta figures',
    stats: [
      { label: 'Widgets counted', value: 1200, note: 'synthetic' },
      { label: 'Share', value: '42%', delta: '+3%' },
    ],
  },
  {
    id: 'three',
    kind: 'quotes',
    title: 'Gamma voices',
    quotes: [
      { text: 'A quiet synthetic remark', source: 'Tester A', likes: 3 },
      { text: 'The loudest synthetic remark', source: 'Tester B', likes: 900 },
      { text: 'An unliked synthetic remark', source: 'Tester C' },
    ],
  },
  {
    id: 'four',
    kind: 'bars',
    title: 'Delta bars',
    bars: [
      { label: 'Foo', value: 30 },
      { label: 'Bar', value: 12, note: 'second' },
    ],
    body: 'A synthetic takeaway.',
  },
  {
    id: 'five',
    kind: 'list',
    title: 'Epsilon moves',
    bullets: ['First synthetic move', 'Second synthetic move'],
  },
  {
    id: 'six',
    kind: 'comparison',
    title: 'Zeta contrast',
    comparison: {
      left: { heading: 'Option left', points: ['Left point'] },
      right: { heading: 'Option right', points: ['Right point'] },
    },
    tags: { pillar: 'state-engineering' },
  },
];

const deck: BrainDeck = { id: 'synthetic-deck', title: 'Synthetic deck', period: '2000-W01', summary: 'A synthetic deck.', slides };

const titles: Record<PillarSlug, string> = {
  'architecture-of-self': 'Pillar One',
  'value-as-waveform': 'Pillar Two',
  'direction-over-outcome': 'Pillar Three',
  'state-engineering': 'Pillar Four',
  'anchored-ascended': 'Pillar Five',
};

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('fixture', () => {
  it('matches the snapshot schema', () => {
    expect(DeckSchema.safeParse(deck).success).toBe(true);
  });
});

describe('SlideRenderer', () => {
  const renderSlide = (i: number) => render(<SlideRenderer slide={slides[i]} index={i} total={slides.length} pillarTitle={(s) => titles[s]} animate={false} />);

  it('renders a headline with its body and tag chips', () => {
    renderSlide(0);
    expect(screen.getByRole('heading', { name: 'Alpha headline' })).toBeInTheDocument();
    expect(screen.getByText('Synthetic body copy for the headline.')).toBeInTheDocument();
    expect(screen.getByText('Perception')).toBeInTheDocument();
    expect(screen.getByText('Pillar One')).toBeInTheDocument();
    expect(screen.getByLabelText('Slide 1 of 6: Alpha headline')).toHaveAttribute('data-kind', 'headline');
  });

  it('renders stats with compact numbers and deltas', () => {
    renderSlide(1);
    expect(screen.getByText('1.2K')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('+3%')).toBeInTheDocument();
    expect(screen.getByText('Widgets counted')).toBeInTheDocument();
  });

  it('features the most-liked quote first and shows likes and sources', () => {
    renderSlide(2);
    const quotes = screen.getAllByRole('blockquote');
    expect(quotes[0]).toHaveTextContent('The loudest synthetic remark');
    expect(quotes[quotes.length - 1]).toHaveTextContent('An unliked synthetic remark');
    expect(screen.getByLabelText('900 likes')).toBeInTheDocument();
    expect(screen.getByText('Tester B')).toBeInTheDocument();
  });

  it('renders bars as an accessible chart with the takeaway', () => {
    renderSlide(3);
    const chart = screen.getByRole('list', { name: 'Delta bars' });
    expect(within(chart).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByLabelText('Foo: 30')).toBeInTheDocument();
    expect(screen.getByLabelText('Bar: 12. second')).toBeInTheDocument();
    expect(screen.getByText('A synthetic takeaway.')).toBeInTheDocument();
  });

  it('renders list and comparison slides', () => {
    renderSlide(4);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['First synthetic move', 'Second synthetic move']);
    renderSlide(5);
    expect(screen.getByRole('heading', { name: 'Option left' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Option right' })).toBeInTheDocument();
    expect(screen.getByText('Pillar Four')).toBeInTheDocument();
  });

  it('degrades gracefully when a kind has no payload', () => {
    render(<SlideRenderer slide={{ id: 'x', kind: 'bars', title: 'Empty bars' }} index={0} total={1} animate={false} />);
    expect(screen.getByText(/no bars in the snapshot/i)).toBeInTheDocument();
  });
});

describe('deck navigation helpers', () => {
  it('clamps and parses the 1-based ?s= param', () => {
    expect(clampIndex(9, 6)).toBe(5);
    expect(clampIndex(-2, 6)).toBe(0);
    expect(parseSlideParam('3', 6)).toBe(2);
    expect(parseSlideParam(['2', '5'], 6)).toBe(1);
    expect(parseSlideParam('99', 6)).toBe(5);
    expect(parseSlideParam('nope', 6)).toBe(0);
    expect(parseSlideParam(undefined, 6)).toBe(0);
  });

  it('maps keys to actions without hijacking buttons or typing', () => {
    const div = document.createElement('div');
    const button = document.createElement('button');
    const input = document.createElement('input');
    const k = (key: string, shiftKey = false) => ({ key, shiftKey, metaKey: false, ctrlKey: false, altKey: false });
    expect(keyToAction(k('ArrowRight'), div)).toBe('next');
    expect(keyToAction(k('ArrowLeft'), button)).toBe('prev');
    expect(keyToAction(k(' '), div)).toBe('next');
    expect(keyToAction(k(' ', true), div)).toBe('prev');
    expect(keyToAction(k(' '), button)).toBeNull();
    expect(keyToAction(k('ArrowRight'), input)).toBeNull();
    expect(keyToAction({ ...k('ArrowRight'), metaKey: true }, div)).toBeNull();
    expect(keyToAction(k('Home'), div)).toBe('first');
    expect(keyToAction(k('End'), div)).toBe('last');
    expect(keyToAction(k('f'), div)).toBe('fullscreen');
    expect(keyToAction(k('s'), div)).toBe('sources');
    expect(keyToAction(k('n'), div)).toBe('nextUnread');
    expect(keyToAction(k('u'), div)).toBe('toggleRead');
    expect(keyToAction(k('r'), div)).toBe('review');
    expect(keyToAction(k('u'), input)).toBeNull();
  });
});

describe('DeckPresenter', () => {
  const live = () => screen.getByText(/^Slide \d+ of 6:/);

  it('navigates with arrows, space, Home and End, and syncs ?s=', () => {
    render(<DeckPresenter deck={deck} pillarTitles={titles} />);
    expect(live()).toHaveTextContent('Slide 1 of 6: Alpha headline');

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(live()).toHaveTextContent('Slide 2 of 6: Beta figures');
    expect(window.location.search).toBe('?s=2');

    fireEvent.keyDown(document.body, { key: ' ' });
    expect(live()).toHaveTextContent('Slide 3 of 6');

    fireEvent.keyDown(document.body, { key: ' ', shiftKey: true });
    expect(live()).toHaveTextContent('Slide 2 of 6');

    fireEvent.keyDown(document.body, { key: 'End' });
    expect(live()).toHaveTextContent('Slide 6 of 6: Zeta contrast');
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled();

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(live()).toHaveTextContent('Slide 6 of 6');

    fireEvent.keyDown(document.body, { key: 'Home' });
    expect(live()).toHaveTextContent('Slide 1 of 6');
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled();
    expect(window.location.search).toBe('?s=1');
  });

  it('jumps via the thumbnail rail and marks the current thumbnail', () => {
    render(<DeckPresenter deck={deck} pillarTitles={titles} />);
    const rail = screen.getByRole('navigation', { name: 'Slides' });
    fireEvent.click(within(rail).getByRole('button', { name: 'Go to slide 4: Delta bars' }));
    expect(live()).toHaveTextContent('Slide 4 of 6: Delta bars');
    expect(within(rail).getByRole('button', { name: 'Go to slide 4: Delta bars' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  });

  it('opens on the deep-linked slide', () => {
    render(<DeckPresenter deck={deck} pillarTitles={titles} initialIndex={parseSlideParam('3', slides.length)} />);
    expect(live()).toHaveTextContent('Slide 3 of 6: Gamma voices');
  });

  it('opens and closes the sources drawer from the keyboard', async () => {
    render(<DeckPresenter deck={deck} pillarTitles={titles} brainCommit="abc1234" />);
    act(() => {
      fireEvent.keyDown(document.body, { key: 's' });
    });
    const drawer = screen.getByRole('dialog', { name: 'Sources for slide 1' });
    expect(within(drawer).getByText('brain/notes/alpha.md')).toBeInTheDocument();
    expect(within(drawer).getAllByRole('link')[0]).toHaveAttribute('href', expect.stringContaining('/blob/abc1234/notes/alpha.md'));

    // Slide keys are inert while the drawer is open.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(live()).toHaveTextContent('Slide 1 of 6');

    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Sources/ })).toHaveFocus();
  });
});

describe('DeckPresenter reading workflow', () => {
  const HASH = deckContentHash(deck);
  const live = () => screen.getByText(/^Slide \d+ of 6:/);
  const note = (extra: Partial<BrainFeedbackRow>): BrainFeedbackRow => ({
    id: '0b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a',
    created_at: '2000-01-01T00:00:00Z',
    updated_at: null,
    author_id: null,
    target_type: 'slide',
    target_id: deck.id,
    deck_id: deck.id,
    slide_id: 'one',
    anchor: null,
    kind: 'change',
    body: 'Synthetic note',
    status: 'open',
    resolved_note: null,
    reply: null,
    replied_at: null,
    synced_to_brain_at: null,
    ...extra,
  });
  const queue = [
    { id: 'newer', title: 'Newer deck', status: 'read' as const },
    { id: deck.id, title: deck.title, status: 'unread' as const },
    { id: 'older', title: 'Older deck', status: 'unread' as const },
  ];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    push.mockReset();
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      const row = {
        id: 'r1',
        user_id: 'u1',
        deck_id: body.deck_id,
        content_hash: body.read === true ? body.content_hash : null,
        read_at: body.read === true ? '2000-01-02T00:00:00Z' : null,
        last_slide: typeof body.last_slide === 'number' ? body.last_slide : 0,
      };
      return new Response(JSON.stringify({ row }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderReading = (initial: { read_at: string | null; content_hash: string | null; last_slide: number } | null = null, extra = {}) =>
    render(
      <DeckPresenter
        deck={deck}
        pillarTitles={titles}
        feedback={{ rows: [note({}), note({ id: '1b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a', slide_id: null, target_type: 'deck', body: 'Deck note', synced_to_brain_at: '2000-01-01T05:00:00Z' })] }}
        reading={{ contentHash: HASH, initial, queue }}
        {...extra}
      />,
    );

  const readCalls = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>).filter((b) => 'read' in b);

  it('shows a collapsible review sidebar with notes and their brain sync status', () => {
    renderReading();
    const sidebar = screen.getByRole('complementary', { name: 'Review' });
    expect(within(sidebar).getByText('Synthetic note')).toBeInTheDocument();
    expect(within(sidebar).getByText('Waiting for sync')).toBeInTheDocument();
    expect(within(sidebar).getByText('scripts/brain/tick.sh --only feedback')).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole('tab', { name: /All of deck/ }));
    expect(within(sidebar).getByText('Deck note')).toBeInTheDocument();
    expect(within(sidebar).getByText('Logged to brain')).toBeInTheDocument();
    expect(within(sidebar).getByText('Deck note').closest('li')).toHaveTextContent(/^Whole deck/);

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Collapse review sidebar' }));
    expect(screen.queryByText('Synthetic note')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('qs-brain-review')).toBe('collapsed');
    act(() => {
      fireEvent.keyDown(document.body, { key: 'r' });
    });
    expect(screen.getByText('Synthetic note')).toBeInTheDocument();
  });

  it('marks the deck read on reaching the last slide, and U toggles it', async () => {
    renderReading();
    expect(screen.getByRole('button', { name: /Mark read/ })).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(document.body, { key: 'End' });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark unread/ })).toBeEnabled());
    expect(readCalls()[0]).toMatchObject({ deck_id: deck.id, read: true, content_hash: HASH, last_slide: 5 });

    act(() => {
      fireEvent.keyDown(document.body, { key: 'u' });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark read/ })).toBeInTheDocument());
    expect(readCalls()[1]).toMatchObject({ deck_id: deck.id, read: false });
    // Staying on the last slide does not re-mark it read.
    expect(readCalls()).toHaveLength(2);
  });

  it('shows "Updated since you read it" when the content hash changed', () => {
    renderReading({ read_at: '2000-01-01T00:00:00Z', content_hash: 'c1-something-else', last_slide: 0 });
    const sidebar = screen.getByRole('complementary', { name: 'Review' });
    expect(within(sidebar).getByText('Updated since you read it')).toBeInTheDocument();
  });

  it('offers the next unread deck at the end and N goes there', () => {
    renderReading({ read_at: '2000-01-01T00:00:00Z', content_hash: HASH, last_slide: 0 });
    expect(screen.queryByRole('link', { name: /Next unread deck →/ })).not.toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(document.body, { key: 'End' });
    });
    expect(screen.getByRole('link', { name: /Next unread deck →/ })).toHaveAttribute('href', '/admin/brain/deck/older?from=decks');
    act(() => {
      fireEvent.keyDown(document.body, { key: 'n' });
    });
    expect(push).toHaveBeenCalledWith('/admin/brain/deck/older?from=decks');
  });

  it('resumes where the reader stopped and can start over', () => {
    renderReading({ read_at: null, content_hash: null, last_slide: 3 }, { initialIndex: 3, reading: { contentHash: HASH, initial: { read_at: null, content_hash: null, last_slide: 3 }, queue, resumedAt: 3 } });
    expect(live()).toHaveTextContent('Slide 4 of 6');
    fireEvent.click(screen.getByRole('button', { name: 'Start from the beginning' }));
    expect(live()).toHaveTextContent('Slide 1 of 6');
  });

  it('saves progress for resume after slide changes', async () => {
    vi.useFakeTimers();
    try {
      renderReading();
      act(() => {
        fireEvent.keyDown(document.body, { key: 'ArrowRight' });
      });
      act(() => {
        vi.advanceTimersByTime(800);
      });
      const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
      expect(bodies).toContainEqual({ deck_id: deck.id, last_slide: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
