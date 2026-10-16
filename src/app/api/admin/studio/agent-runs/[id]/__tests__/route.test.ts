import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin/auth', () => ({
  validateAdminApiRequest: vi.fn(),
  logAdminAction: vi.fn(async () => {}),
}));
vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: { from: vi.fn() } }));

import { PATCH } from '../route';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const RUN_ID = '0b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a';
const ADMIN = { id: '9c1d2e3f-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/admin/studio/agent-runs/${RUN_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const params = (id = RUN_ID) => ({ params: Promise.resolve({ id }) });

/** content_agent_runs: select(...).eq(...).maybeSingle() then update(...).eq(...).select(...).maybeSingle() */
function mockTable(existing: { status: string } | null) {
  const update = vi.fn((patch: Record<string, unknown>) => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: RUN_ID, ...patch }, error: null })) })),
    })),
  }));
  vi.mocked(supabaseAdmin.from).mockImplementation(
    () =>
      ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: existing ? { id: RUN_ID, human_approved: null, ...existing } : null, error: null })),
          })),
        })),
        update,
      }) as never,
  );
  return { update };
}

describe('PATCH /api/admin/studio/agent-runs/[id]', () => {
  beforeEach(() => {
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: ADMIN, error: null });
  });

  it('401s without an admin session', async () => {
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: null, error: 'Not authenticated' });
    const res = await PATCH(request({ human_approved: true }), params());
    expect(res.status).toBe(401);
  });

  it('writes human_approved and approved_by, and audits the action', async () => {
    const { update } = mockTable({ status: 'completed' });
    const res = await PATCH(request({ human_approved: true }), params());
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ human_approved: true, approved_by: ADMIN.id, status: 'completed' });
    const json = await res.json();
    expect(json.run.human_approved).toBe(true);
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'content_agent_run_approved', targetId: RUN_ID }));
  });

  it('400s on malformed JSON', async () => {
    mockTable({ status: 'completed' });
    const res = await PATCH(request('{oops'), params());
    expect(res.status).toBe(400);
  });

  it('404s for an unknown run and 409s for a running one', async () => {
    mockTable(null);
    expect((await PATCH(request({ human_approved: true }), params())).status).toBe(404);
    mockTable({ status: 'running' });
    expect((await PATCH(request({ human_approved: true }), params())).status).toBe(409);
  });
});
