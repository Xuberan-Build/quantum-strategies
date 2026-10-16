import { describe, it, expect, vi } from 'vitest';
import {
  applyAgentRunApproval,
  parseApprovalBody,
  MAX_FEEDBACK_LENGTH,
  type AgentRunStore,
} from '../agent-run-approval';

const RUN_ID = '0b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a';
const ADMIN_ID = '9c1d2e3f-0000-4000-8000-000000000001';

function makeStore(run: { status: string } | null, overrides: Partial<AgentRunStore> = {}): AgentRunStore & {
  updateRun: ReturnType<typeof vi.fn>;
} {
  const updateRun = vi.fn(async (id: string, patch: Record<string, unknown>) => ({ data: { id, ...patch }, error: null }));
  return {
    getRun: vi.fn(async () => ({ data: run ? { id: RUN_ID, human_approved: null, ...run } : null, error: null })),
    updateRun,
    ...overrides,
  } as AgentRunStore & { updateRun: ReturnType<typeof vi.fn> };
}

describe('parseApprovalBody', () => {
  it('requires a boolean human_approved', () => {
    expect(parseApprovalBody(null).ok).toBe(false);
    expect(parseApprovalBody([]).ok).toBe(false);
    expect(parseApprovalBody({}).ok).toBe(false);
    expect(parseApprovalBody({ human_approved: 'yes' }).ok).toBe(false);
    expect(parseApprovalBody({ human_approved: true })).toEqual({ ok: true, approved: true, feedback: undefined });
  });

  it('validates and trims feedback', () => {
    expect(parseApprovalBody({ human_approved: false, feedback: 42 }).ok).toBe(false);
    expect(parseApprovalBody({ human_approved: false, feedback: 'x'.repeat(MAX_FEEDBACK_LENGTH + 1) }).ok).toBe(false);
    expect(parseApprovalBody({ human_approved: false, feedback: '  too salesy  ' })).toEqual({ ok: true, approved: false, feedback: 'too salesy' });
    expect(parseApprovalBody({ human_approved: false, feedback: '   ' })).toEqual({ ok: true, approved: false, feedback: null });
  });
});

describe('applyAgentRunApproval', () => {
  it('approves a completed run and records who approved it', async () => {
    const store = makeStore({ status: 'completed' });
    const out = await applyAgentRunApproval({ runId: RUN_ID, body: { human_approved: true }, adminUserId: ADMIN_ID, store });
    expect(out).toMatchObject({ ok: true, status: 200 });
    expect(store.updateRun).toHaveBeenCalledWith(RUN_ID, { human_approved: true, approved_by: ADMIN_ID, status: 'completed' });
  });

  it('rejects with feedback: status rejected, approver cleared', async () => {
    const store = makeStore({ status: 'completed' });
    const out = await applyAgentRunApproval({
      runId: RUN_ID,
      body: { human_approved: false, feedback: 'Off voice' },
      adminUserId: ADMIN_ID,
      store,
    });
    expect(out.ok).toBe(true);
    expect(store.updateRun).toHaveBeenCalledWith(RUN_ID, {
      human_approved: false,
      approved_by: null,
      status: 'rejected',
      feedback: 'Off voice',
    });
  });

  it('can re-approve a previously rejected run', async () => {
    const store = makeStore({ status: 'rejected' });
    const out = await applyAgentRunApproval({ runId: RUN_ID, body: { human_approved: true }, adminUserId: ADMIN_ID, store });
    expect(out.ok).toBe(true);
  });

  it('400s on a bad id or body without touching the store', async () => {
    const store = makeStore({ status: 'completed' });
    expect(await applyAgentRunApproval({ runId: 'nope', body: { human_approved: true }, adminUserId: ADMIN_ID, store })).toMatchObject({ ok: false, status: 400 });
    expect(await applyAgentRunApproval({ runId: RUN_ID, body: {}, adminUserId: ADMIN_ID, store })).toMatchObject({ ok: false, status: 400 });
    expect(store.getRun).not.toHaveBeenCalled();
  });

  it('404s when the run does not exist', async () => {
    const out = await applyAgentRunApproval({ runId: RUN_ID, body: { human_approved: true }, adminUserId: ADMIN_ID, store: makeStore(null) });
    expect(out).toMatchObject({ ok: false, status: 404 });
  });

  it('409s for runs that have not finished', async () => {
    for (const status of ['pending', 'running', 'failed']) {
      const store = makeStore({ status });
      const out = await applyAgentRunApproval({ runId: RUN_ID, body: { human_approved: true }, adminUserId: ADMIN_ID, store });
      expect(out).toMatchObject({ ok: false, status: 409 });
      expect(store.updateRun).not.toHaveBeenCalled();
    }
  });

  it('surfaces store errors as 500 instead of swallowing them', async () => {
    const readFail = makeStore({ status: 'completed' }, { getRun: async () => ({ data: null, error: 'connection reset' }) });
    expect(await applyAgentRunApproval({ runId: RUN_ID, body: { human_approved: true }, adminUserId: ADMIN_ID, store: readFail })).toEqual({
      ok: false,
      status: 500,
      error: 'connection reset',
    });
    const writeFail = makeStore({ status: 'completed' }, { updateRun: async () => ({ data: null, error: 'permission denied' }) });
    expect(await applyAgentRunApproval({ runId: RUN_ID, body: { human_approved: true }, adminUserId: ADMIN_ID, store: writeFail })).toMatchObject({
      ok: false,
      status: 500,
    });
  });
});
