import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin/auth', () => ({ validateAdminApiRequest: vi.fn() }));
vi.mock('@/lib/brain/topical-map', () => ({
  getTopicalMap: vi.fn(),
  getTopic: vi.fn(),
  getTopicalQueue: vi.fn(),
}));

import { GET as getMap } from '../route';
import { GET as getTopicRoute } from '../topic/[...id]/route';
import { GET as getQueue } from '../queue/route';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getTopic, getTopicalMap, getTopicalQueue } from '@/lib/brain/topical-map';
import type { TopicNode, TopicScorecard } from '@/lib/brain/topical-map';

const ADMIN = { id: '9c1d2e3f-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

const NODE: TopicNode = {
  id: 'topic:alpha',
  level: 'topic',
  label: 'Alpha',
  parent: 'topic:pillar-a',
  pillarCode: 'P1',
  intent: 'problem',
  scores: { demand: 80, proof: 60, coverage: 10, competition: 30, productFit: 70, priority: 77 },
  status: 'TO BUILD',
  queryCount: 12,
};

const MAP = {
  centralEntity: { label: 'Centre', definition: 'A definition.' },
  sourceContext: 'Synthetic.',
  generatedAt: '2026-10-17T00:00:00Z',
  nodes: [NODE],
};

const CARD: TopicScorecard = {
  ...NODE,
  queries: [{ text: 'why does x', sources: ['autocomplete'], signal: 50 }],
  problems: [],
  claims: [],
  assets: [],
  competitors: [],
  products: [],
  queuePosition: 3,
};

const ctx = (...id: string[]) => ({ params: Promise.resolve({ id }) });
const req = (url = 'http://localhost/x') => new NextRequest(url);

describe('/api/admin/brain/map routes', () => {
  beforeEach(() => {
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: ADMIN, error: null });
    vi.mocked(getTopicalMap).mockReset();
    vi.mocked(getTopic).mockReset();
    vi.mocked(getTopicalQueue).mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('401s every route without an admin session, before loading data', async () => {
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: null, error: 'Not authenticated' });
    const res = await Promise.all([getMap(), getTopicRoute(req(), ctx('topic:alpha')), getQueue(req('http://localhost/api/admin/brain/map/queue'))]);
    expect(res.map((r) => r.status)).toEqual([401, 401, 401]);
    expect(getTopicalMap).not.toHaveBeenCalled();
    expect(getTopic).not.toHaveBeenCalled();
    expect(getTopicalQueue).not.toHaveBeenCalled();
  });

  it('returns the map as the data layer shapes it', async () => {
    vi.mocked(getTopicalMap).mockResolvedValue(MAP);
    const res = await getMap();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(MAP);
    expect(json.fixture).toBeUndefined();
  });

  it('never serves the map fixture outside development', async () => {
    vi.mocked(getTopicalMap).mockRejectedValue(new Error('relation does not exist'));
    vi.stubEnv('NODE_ENV', 'production');
    const prod = await getMap();
    expect(prod.status).toBe(500);
    const body = await prod.json();
    expect(body.fixture).toBeUndefined();
    expect(body.nodes).toEqual([]);

    vi.stubEnv('NODE_ENV', 'development');
    const dev = await getMap();
    expect(dev.status).toBe(200);
    const devBody = await dev.json();
    expect(devBody.fixture).toBe(true);
    expect(devBody.nodes.length).toBeGreaterThan(300);
    expect(devBody.centralEntity.label).toBeTruthy();
  });

  it('decodes the topic id, rejects malformed ids and returns the scorecard', async () => {
    for (const bad of [['nope'], ['pillar:alpha'], ['topic:a b'], ['topic:..', 'x']]) {
      const res = await getTopicRoute(req(), ctx(...bad));
      expect(res.status).toBe(400);
    }
    expect(getTopic).not.toHaveBeenCalled();

    vi.mocked(getTopic).mockResolvedValue(CARD);
    const res = await getTopicRoute(req(), ctx('topic%3Aalpha'));
    expect(res.status).toBe(200);
    expect(getTopic).toHaveBeenCalledWith('topic:alpha');
    expect(await res.json()).toEqual(CARD);

    await getTopicRoute(req(), ctx('topic:a', 'b'));
    expect(getTopic).toHaveBeenLastCalledWith('topic:a/b');
  });

  it('404s an unknown topic in production and 500s a failed load', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(getTopic).mockResolvedValue(null);
    expect((await getTopicRoute(req(), ctx('topic:ghost'))).status).toBe(404);
    vi.mocked(getTopic).mockRejectedValue(new Error('boom'));
    const res = await getTopicRoute(req(), ctx('topic:ghost'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Could not load the topic');
  });

  it('serves a fixture scorecard in development when the data layer fails', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(getTopic).mockRejectedValue(new Error('not built'));
    const res = await getTopicRoute(req(), ctx('topic:fixture-topic-2-1-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ id: 'topic:fixture-topic-2-1-1', fixture: true });
    expect(Array.isArray(json.queries)).toBe(true);
  });

  it('returns the queue, clamping the limit', async () => {
    const items = [{ id: 'topic:alpha', label: 'Alpha', pillarCode: 'P1', priority: 77, demand: 80, proof: 60, coverage: 10, status: 'TO BUILD', topQueries: ['why does x'] }];
    vi.mocked(getTopicalQueue).mockResolvedValue(items as never);
    const res = await getQueue(req('http://localhost/api/admin/brain/map/queue?limit=500'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items });
    expect(getTopicalQueue).toHaveBeenLastCalledWith(100);

    await getQueue(req('http://localhost/api/admin/brain/map/queue'));
    expect(getTopicalQueue).toHaveBeenLastCalledWith(20);
    await getQueue(req('http://localhost/api/admin/brain/map/queue?limit=-3'));
    expect(getTopicalQueue).toHaveBeenLastCalledWith(1);
  });

  it('500s a failed queue in production, fixture in development', async () => {
    vi.mocked(getTopicalQueue).mockRejectedValue(new Error('function topical_map_queue() does not exist'));
    vi.stubEnv('NODE_ENV', 'production');
    const prod = await getQueue(req('http://localhost/api/admin/brain/map/queue'));
    expect(prod.status).toBe(500);
    expect(await prod.json()).toEqual({ error: 'Could not load the queue', items: [] });

    vi.stubEnv('NODE_ENV', 'development');
    const dev = await getQueue(req('http://localhost/api/admin/brain/map/queue?limit=5'));
    const body = await dev.json();
    expect(body.fixture).toBe(true);
    expect(body.items).toHaveLength(5);
  });
});
