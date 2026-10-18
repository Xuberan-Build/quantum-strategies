import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReadCheckoutClient from '../ReadCheckoutClient';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function mockFetch(routes: Record<string, { status: number; body: unknown }>) {
  const fn = vi.fn(async (url: string) => {
    const r = routes[url];
    if (!r) throw new Error(`unexpected fetch ${url}`);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('ReadCheckoutClient (/read/checkout)', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('signed in: links the lead, starts /api/checkout for perception-rite-bundle, redirects to Stripe', async () => {
    const fetchFn = mockFetch({
      '/api/read/checkout': { status: 200, body: { ok: true } },
      '/api/checkout': { status: 200, body: { url: 'https://checkout.stripe.test/s' } },
    });
    const navigate = vi.fn();
    render(<ReadCheckoutClient sessionId={SESSION_ID} signedIn leadEmailMasked={null} navigate={navigate} />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://checkout.stripe.test/s'));
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['/api/read/checkout', '/api/checkout']);
    expect(JSON.parse((fetchFn.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      productSlug: 'perception-rite-bundle',
      readSessionId: SESSION_ID,
    });
  });

  it('signed in and already owns Rite I: points to the dashboard', async () => {
    mockFetch({
      '/api/read/checkout': { status: 200, body: { ok: true } },
      '/api/checkout': { status: 409, body: { error: 'You already own everything in this Rite' } },
    });
    render(<ReadCheckoutClient sessionId={SESSION_ID} signedIn leadEmailMasked={null} navigate={vi.fn()} />);
    expect(await screen.findByText('You already own Rite I')).toBeInTheDocument();
  });

  it('not signed in: offers the magic link to the masked lead email and confirms it was sent', async () => {
    const fetchFn = mockFetch({ '/api/read/checkout/link': { status: 200, body: { ok: true, maskedEmail: 'sa***@example.test' } } });
    const navigate = vi.fn();
    render(<ReadCheckoutClient sessionId={SESSION_ID} signedIn={false} leadEmailMasked="sa***@example.test" navigate={navigate} />);
    expect(screen.getByText('Get Rite I for $12')).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Email me the sign-in link' }));
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(fetchFn).toHaveBeenCalledWith('/api/read/checkout/link', expect.objectContaining({ method: 'POST' }));
    expect(navigate).not.toHaveBeenCalled();
    const signIn = screen.getByRole('link', { name: 'Sign in' });
    expect(signIn.getAttribute('href')).toBe(`/login?redirect=${encodeURIComponent(`/read/checkout/?session=${SESSION_ID}`)}`);
  });

  it('shows the different-browser note after a failed magic link', () => {
    render(<ReadCheckoutClient sessionId={SESSION_ID} signedIn={false} leadEmailMasked="sa***@example.test" signinFailed />);
    expect(screen.getByText(/opened in a different browser/)).toBeInTheDocument();
  });

  it('without a session id, sends them back to the Read', () => {
    render(<ReadCheckoutClient sessionId={null} signedIn={false} leadEmailMasked={null} />);
    expect(screen.getByText('This link is missing your Read')).toBeInTheDocument();
  });
});
