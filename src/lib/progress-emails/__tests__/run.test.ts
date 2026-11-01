import { beforeAll, describe, expect, it, vi } from 'vitest';
import { runProgressEmails, type RunDeps } from '../run';
import type { Candidate, ProgressEmailStore } from '../store';
import { NOW, daysAgo, owned, snap } from './fixtures';

beforeAll(() => {
  process.env.READ_LINK_SECRET = 'test-secret';
});

/** In-memory store with the same claim semantics as the unique constraint. */
function memoryStore(candidates: Candidate[]) {
  const rows = new Map<string, 'claimed' | 'sent'>();
  const store: ProgressEmailStore = {
    loadCandidates: async () => candidates,
    claim: async (u, k) => (rows.has(`${u}|${k}`) ? false : (rows.set(`${u}|${k}`, 'claimed'), true)),
    markSent: async (u, k) => void rows.set(`${u}|${k}`, 'sent'),
    release: async (u, k) => void rows.delete(`${u}|${k}`),
  };
  return { store, rows };
}

function deps(over: Partial<RunDeps> & { store: ProgressEmailStore }): RunDeps {
  return {
    mode: 'send',
    now: NOW,
    deliver: vi.fn(async () => ({ ok: true, mode: 'send' as const })),
    ctx: { appUrl: 'https://quantumstrategies.online', businessName: 'Quantum Strategies', founderName: 'Austin' },
    founderEmail: 'austin@example.com',
    ...over,
  };
}

const stalled: Candidate = { snapshot: snap(), history: [] };
const optedOut: Candidate = {
  snapshot: snap({ user: { ...snap().user, id: '33333333-3333-4333-8333-333333333333' }, prefs: { progress: false, newsletter: true }, access: owned({ 'perception-rite-scan-1': daysAgo(30) }), lastSessionAt: daysAgo(30) }),
  history: [],
};

describe('runProgressEmails', () => {
  it('does nothing when off', async () => {
    const { store } = memoryStore([stalled]);
    const d = deps({ store, mode: 'off' });
    expect((await runProgressEmails(d)).considered).toBe(0);
    expect(d.deliver).not.toHaveBeenCalled();
  });

  it('preview renders everything but claims nothing', async () => {
    const { store, rows } = memoryStore([stalled, optedOut]);
    const d = deps({ store, mode: 'preview' });
    const r = await runProgressEmails(d);
    expect(r.emails).toEqual({ reentry: 1 });
    expect(r.alerted).toBe(2);
    expect(d.deliver).toHaveBeenCalledTimes(2); // one user email + one digest
    expect(rows.size).toBe(0);
  });

  it('send claims, sends, and never sends the same email twice', async () => {
    const { store, rows } = memoryStore([stalled, optedOut]);
    const d = deps({ store });
    await runProgressEmails(d);
    expect([...rows.values()].every((v) => v === 'sent')).toBe(true);
    expect(rows.size).toBe(3); // reentry + two alerts

    const again = await runProgressEmails(d);
    expect(again.alreadyClaimed).toBe(3);
    expect(d.deliver).toHaveBeenCalledTimes(2);
  });

  it('a failed send releases its claim so tomorrow retries', async () => {
    const { store, rows } = memoryStore([stalled]);
    const d = deps({ store, founderEmail: null, deliver: vi.fn(async () => ({ ok: false, mode: 'send' as const, error: 'boom' })) });
    const r = await runProgressEmails(d);
    expect(r.errors).toHaveLength(1);
    expect(rows.size).toBe(0);
  });

  it('the digest goes to the founder and includes opted-out users', async () => {
    const { store } = memoryStore([optedOut]);
    const d = deps({ store });
    await runProgressEmails(d);
    const calls = vi.mocked(d.deliver).mock.calls;
    const digest = calls.find(([msg]) => msg.kind === 'progress-founder-digest')![0];
    expect(digest.to).toBe('austin@example.com');
    expect(digest.text).toContain('Opted out of progress emails');
  });
});
