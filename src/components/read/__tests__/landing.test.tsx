import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createReadApi } from '../api';
import { LANDING_LINES } from '../copy';
import { ReadApiProvider } from '../ReadApiContext';
import { ReadLanding } from '../ReadLanding';
import { carryQuery, paramsFromRecord, parseUtm, resolveVariant } from '../utm';
import { createMockApi } from './fixtures';

const params = (q: string) => new URLSearchParams(q);

describe('UTM capture', () => {
  it('reads the UTM set and drops empty values', () => {
    expect(parseUtm(params('utm_source=youtube&utm_medium=video&utm_campaign=c1&utm_content=stall&utm_term='))).toEqual({
      source: 'youtube',
      medium: 'video',
      campaign: 'c1',
      content: 'stall',
    });
  });

  it('switches on the manifestation variant from ?v= or utm_content=method', () => {
    expect(resolveVariant(params('v=manifestation'))).toBe('manifestation');
    expect(resolveVariant(params('utm_content=method'))).toBe('manifestation');
    expect(resolveVariant(params('v=other'))).toBeUndefined();
    expect(parseUtm(params('v=manifestation')).variant).toBe('manifestation');
  });

  it('carries only the UTM keys and v to the flow', () => {
    expect(carryQuery(paramsFromRecord({ v: 'manifestation', utm_source: 'reddit', email: 'x@y.z' }))).toBe(
      '?v=manifestation&utm_source=reddit'
    );
    expect(carryQuery(params(''))).toBe('');
  });
});

describe('ReadLanding', () => {
  it('leads with the misalignment line and the facts, and records the view', () => {
    const api = createMockApi();
    render(
      <ReadApiProvider api={api}>
        <ReadLanding utm={{ source: 'youtube' }} carry="?utm_source=youtube" />
      </ReadApiProvider>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'The Perception Read' })).toBeInTheDocument();
    expect(screen.getByText(LANDING_LINES.default)).toBeInTheDocument();
    expect(screen.getByText('12 questions')).toBeInTheDocument();
    expect(screen.getByText('No birth chart')).toBeInTheDocument();
    expect(screen.getByText(/asks for your email/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Start the Read' })[0]).toHaveAttribute('href', expect.stringMatching(/^\/read\/start\/?\?utm_source=youtube$/));
    expect(api.event).toHaveBeenCalledWith({ event: 'read_view_landing', props: { variant: null, utm: { source: 'youtube' } } });
  });

  it('uses the manifestation line on that traffic', () => {
    render(
      <ReadApiProvider api={createMockApi()}>
        <ReadLanding utm={{ variant: 'manifestation' }} variant="manifestation" carry="?v=manifestation" />
      </ReadApiProvider>
    );
    expect(screen.getByText(LANDING_LINES.method)).toBeInTheDocument();
    expect(screen.getByText(/Keep your practice/)).toBeInTheDocument();
  });

  it('never uses the banned words in visible copy', () => {
    const { container } = render(
      <ReadApiProvider api={createMockApi()}>
        <ReadLanding utm={{}} carry="" />
      </ReadApiProvider>
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/quantum|quiz|assessment|archetype|—/i);
  });
});

describe('createReadApi', () => {
  it('posts to the contract routes and raises status errors', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/start')) return new Response(JSON.stringify({ sessionId: 's1' }), { status: 200 });
      if (url.includes('/questions')) return new Response(JSON.stringify({ questions: [] }), { status: 200 });
      if (url.includes('/result/')) return new Response(JSON.stringify({ error: 'locked' }), { status: 403 });
      return new Response(null, { status: 204 });
    });
    const api = createReadApi(fetchMock as never);

    await expect(api.start({ variant: 'manifestation' })).resolves.toEqual({ sessionId: 's1' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/read/start',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ variant: 'manifestation' }) })
    );
    await api.getQuestions({ segment: 'operator', variant: 'manifestation' });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/read/questions?segment=operator&variant=manifestation', expect.anything());
    await expect(api.getResult('s1', 'tok')).rejects.toMatchObject({ status: 403, message: 'locked' });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/read/result/s1?t=tok', expect.anything());
    await expect(api.event({ event: 'read_start' })).resolves.toBeUndefined();
    await expect(api.feedback({ sessionId: 's1', accuracy: 5 })).resolves.toBeUndefined();
  });

  it('never throws from event()', async () => {
    const api = createReadApi((async () => {
      throw new Error('offline');
    }) as never);
    await expect(api.event({ event: 'read_view_landing' })).resolves.toBeUndefined();
  });
});
