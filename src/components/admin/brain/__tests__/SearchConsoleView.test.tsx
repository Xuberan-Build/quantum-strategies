import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchConsoleView } from '../search/SearchConsoleView';
import type { SearchReport } from '@/lib/seo/search-report';

const loa = { id: 'topic:loa', label: 'Law of attraction', pillarCode: 'P1' as const, level: 'topic' as const };
const nlp = { id: 'topic:nlp', label: 'NLP techniques', pillarCode: 'P2' as const, level: 'topic' as const };

const report: SearchReport = {
  configured: { siteUrl: 'sc-domain:quantumstrategies.online', credentials: true, indexNow: true },
  hasData: true,
  period: { startDate: '2026-09-18', endDate: '2026-10-15' },
  previous: { startDate: '2026-08-21', endDate: '2026-09-17' },
  totals: { clicks: 40, impressions: 2000, ctr: 0.02, position: 18.2 },
  prevTotals: { clicks: 20, impressions: 1000, ctr: 0.02, position: 22 },
  daily: [
    { date: '2026-10-14', clicks: 1, impressions: 60, position: 18 },
    { date: '2026-10-15', clicks: 2, impressions: 80, position: 17 },
  ],
  index: { inspected: 10, indexed: 7, notIndexed: 3, lastInspected: '2026-10-17T09:30:00Z', states: [{ state: 'Submitted and indexed', count: 7 }] },
  keywords: [
    { query: 'law of attraction', topic: loa, match: 'head_term', volume: 90000, clicks: 5, impressions: 300, ctr: 5 / 300, position: 14.2, prevPosition: 19, prevClicks: 1, prevImpressions: 100, page: null },
    { query: 'random thing', topic: null, match: null, volume: null, clicks: 0, impressions: 4, ctr: 0, position: 60, prevPosition: null, prevClicks: 0, prevImpressions: 0, page: null },
  ],
  headTerms: [
    { topic: loa, headTerm: 'law of attraction', volume: 90000, position: 14.2, clicks: 5, impressions: 300, prevPosition: 19 },
    { topic: nlp, headTerm: 'nlp techniques', volume: 5400, position: null, clicks: 0, impressions: 0, prevPosition: null },
  ],
  pages: [{ page: 'https://quantumstrategies.online/articles/loa/', topic: loa, clicks: 5, impressions: 300, ctr: 0.016, position: 14, prevClicks: 2, inspection: { url: 'https://quantumstrategies.online/articles/loa/', inspected_at: '2026-10-17', verdict: 'PASS', coverage_state: 'Submitted and indexed', indexing_state: null, last_crawl_time: '2026-10-12T00:00:00Z', google_canonical: null, user_canonical: null } }],
  pillars: ['P1', 'P2'],
  lastFetched: '2026-10-18T09:31:00Z',
};

describe('SearchConsoleView', () => {
  it('shows the overview and tracked head terms, with not ranking yet', () => {
    render(<SearchConsoleView report={report} />);
    expect(screen.getAllByText('+100% vs previous')).toHaveLength(2);
    expect(screen.getByText('not ranking yet')).toBeTruthy();
    expect(screen.getByText('▲ 4.8')).toBeTruthy();
  });

  it('switches to keywords and filters by pillar', () => {
    render(<SearchConsoleView report={report} />);
    fireEvent.click(screen.getByRole('tab', { name: /All keywords/ }));
    expect(screen.getByText('random thing')).toBeTruthy();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'P1' } });
    expect(screen.queryByText('random thing')).toBeNull();
    expect(screen.getByText('law of attraction')).toBeTruthy();
  });

  it('shows index status on the pages view', () => {
    render(<SearchConsoleView report={report} />);
    fireEvent.click(screen.getByRole('tab', { name: /Pages/ }));
    expect(screen.getByText('indexed')).toBeTruthy();
    expect(screen.getByText('/articles/loa/')).toBeTruthy();
  });

  it('explains when Search Console is not connected', () => {
    render(<SearchConsoleView report={{ ...report, configured: { siteUrl: null, credentials: false, indexNow: false }, hasData: false }} />);
    expect(screen.getByText('Not connected yet')).toBeTruthy();
  });
});
