import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DeckIndexEntry } from '@/lib/brain/snapshot';
import { DeckArchive } from '../DeckArchive';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/* Synthetic fixtures only. */
const entry = (id: string, createdAt: string, contentHash: string): DeckIndexEntry => ({
  id,
  title: `Deck ${id}`,
  period: 'p',
  summary: `Summary ${id}`,
  createdAt,
  status: 'current',
  slideCount: 8,
  tags: [],
  contentHash,
});

const decks = [entry('a', '2000-01-04', 'h-a'), entry('b', '2000-01-03', 'h-b'), entry('c', '2000-01-02', 'h-c-new'), entry('d', '2000-01-01', 'h-d')];
const reads = {
  a: { read_at: '2000-01-05T00:00:00Z', content_hash: 'h-a', last_slide: 7 }, // read
  c: { read_at: '2000-01-05T00:00:00Z', content_hash: 'h-c-old', last_slide: 7 }, // updated
  d: { read_at: null, content_hash: null, last_slide: 2 }, // in progress
};

const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('DeckArchive reading workflow', () => {
  it('shows N of M read, badges, open notes, and sorts unread first', () => {
    render(<DeckArchive decks={decks} reads={reads} noteStats={{ b: { open: 2, unsynced: 1 } }} />);
    expect(screen.getByLabelText('1 of 4 decks read')).toBeInTheDocument();
    expect(titles()).toEqual(['Deck b', 'Deck d', 'Deck c', 'Deck a']);
    expect(screen.getByRole('heading', { level: 2, name: 'Unread' })).toBeInTheDocument();
    const b = screen.getByText('Deck b').closest('li')!;
    expect(within(b).getByText('2 open notes')).toBeInTheDocument();
    expect(b).toHaveAttribute('data-read-status', 'unread');
    expect(screen.getByText('Deck c').closest('li')).toHaveTextContent('Updated since you read it');
    expect(screen.getByText('Deck d').closest('li')).toHaveTextContent('Stopped at slide 3 of 8');
    expect(within(screen.getByText('Deck d').closest('li')!).getByRole('link', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByText('1 note')).toBeInTheDocument(); // sync hint
  });

  it('filters by Unread, Updated and Read', () => {
    render(<DeckArchive decks={decks} reads={reads} />);
    const group = screen.getByRole('group', { name: 'Filter by read status' });
    expect(within(group).getByRole('button', { name: /Unread/ })).toHaveTextContent('Unread 2');

    fireEvent.click(within(group).getByRole('button', { name: /Unread/ }));
    expect(titles()).toEqual(['Deck b', 'Deck d']);
    fireEvent.click(within(group).getByRole('button', { name: /Updated/ }));
    expect(titles()).toEqual(['Deck c']);
    fireEvent.click(within(group).getByRole('button', { name: /^Read/ }));
    expect(titles()).toEqual(['Deck a']);
    fireEvent.click(within(group).getByRole('button', { name: /All/ }));
    expect(titles()).toHaveLength(4);
  });

  it('treats every deck as unread without receipts', () => {
    render(<DeckArchive decks={decks} />);
    expect(screen.getByLabelText('0 of 4 decks read')).toBeInTheDocument();
    expect(screen.queryByRole('note', { name: 'Sync notes to the brain' })).toBeNull();
  });
});
